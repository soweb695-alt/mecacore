import "server-only";
import { db, type Tx } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/errors";
import { ajouterJours, calculerStatutFacture } from "@/lib/facture-statut";
import { getFactureProvider } from "@/lib/integrations/facture-electronique";
import { nomClient } from "@/lib/format";
import { envoyerEmail } from "@/lib/services/messages";
import { emailRecapImpayes } from "@/lib/messages/templates";
import { prochainNumero } from "@/lib/numbering";
import { appliquerRemiseGlobale, appliquerRemisePro, calculerTotaux, round2, totalLigneHT, type RemiseGlobale, type Totaux } from "@/lib/money";
import { quantitesParPiece } from "@/lib/services/devis";
import { verifierReapprovisionnement } from "@/lib/services/reappro";
import type { LigneInput } from "@/lib/validators/devis";

export interface OptionsFacture {
  remise?: RemiseGlobale | null;
  modePaiement?: "CB" | "ESPECES" | "CHEQUE" | "VIREMENT" | "PLUSIEURS_FOIS" | null;
}

/** Totaux après remise globale + colonnes à enregistrer (la remise est tracée sur la facture et son PDF). */
function totauxEtRemise(totaux: Totaux, opts?: OptionsFacture) {
  let t;
  try {
    t = appliquerRemiseGlobale(totaux, opts?.remise);
  } catch {
    throw new ApiError(400, "La remise doit être inférieure au total de la facture", "REMISE_INVALIDE");
  }
  const r = opts?.remise && opts.remise.valeur > 0 ? opts.remise : null;
  return {
    totalHT: t.totalHT,
    totalTVA: t.totalTVA,
    totalTTC: t.totalTTC,
    remiseGlobaleType: r?.type ?? null,
    remiseGlobaleBase: r?.base ?? null,
    remiseGlobaleValeur: r?.valeur ?? 0,
    remiseGlobaleMontant: t.montantRemise,
    totalHTAvantRemise: r ? t.totalHTAvantRemise : null,
    modePaiement: opts?.modePaiement ?? null,
  };
}

type LigneDevisCopiee = Prisma.LigneDevisGetPayload<{ include: { piece: { select: { prixAchatHT: true } } } }>;

/** Ligne de devis recopiée sur la facture (prix d'achat figé pour l'analyse des marges, pièces des forfaits comprises). */
function copieLigneDevis(l: LigneDevisCopiee) {
  return {
    type: l.type,
    designation: l.designation,
    quantite: l.quantite,
    prixUnitaireHT: l.prixUnitaireHT,
    prixCatalogueHT: l.prixCatalogueHT,
    tvaRate: l.tvaRate,
    totalHT: l.totalHT,
    prixAchatHT: l.piece?.prixAchatHT ?? null,
    pieceId: l.pieceId,
    composition: (l.composition as Prisma.InputJsonValue | null) ?? undefined,
    position: l.position,
  };
}

/** OR traité par le Magasin : passage en « Facturé » et fiche de contrôle marquée traitée. */
export async function cloturerOrdre(tx: Tx, ordreId: string, userId?: string) {
  await tx.ordreReparation.updateMany({ where: { id: ordreId, statut: "A_TRAITER_MAGASIN" }, data: { statut: "FACTURE" } });
  await tx.ficheControle.updateMany({ where: { ordreId, statut: "TRANSMISE" }, data: { statut: "TRAITEE", traiteeLe: new Date(), traiteeParId: userId ?? null } });
}

/**
 * Facture « Brouillon » préparée quand l'atelier termine un OR : lignes du devis, sans numéro.
 * Le Magasin la modifie puis l'émet (numérotation à l'émission). Sans effet si le devis est déjà facturé.
 */
export async function creerBrouillonTx(tx: Tx, ordreId: string) {
  const o = await tx.ordreReparation.findUnique({
    where: { id: ordreId },
    include: { devis: { include: { client: true, facture: { select: { id: true, statut: true } }, lignes: { orderBy: { position: "asc" }, include: { piece: { select: { prixAchatHT: true } } } } } } },
  });
  if (!o) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
  if (o.devis.facture) return o.devis.facture;
  const now = new Date();
  return tx.facture.create({
    data: {
      numero: null,
      statut: "BROUILLON",
      devisId: o.devisId,
      clientId: o.devis.clientId,
      dateEmission: now,
      dateEcheance: ajouterJours(now, o.devis.client.paymentTerms ?? 30),
      remisePro: o.devis.remisePro,
      kilometrage: o.kilometrage ?? o.devis.kilometrage,
      totalHT: o.devis.totalHT,
      totalTVA: o.devis.totalTVA,
      totalTTC: o.devis.totalTTC,
      lignes: { create: o.devis.lignes.map(copieLigneDevis) },
    },
    select: { id: true, statut: true },
  });
}

export interface BrouillonInput {
  dateEcheance?: string;
  lignes: (LigneInput & { id?: string })[];
}

/** Modification d'un brouillon : lignes, échéance, remise globale et mode de règlement. Le stock n'est ajusté qu'à l'émission. */
export async function modifierBrouillon(id: string, input: BrouillonInput & OptionsFacture) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Facture" WHERE id = ${id} FOR UPDATE`;
    const f = await tx.facture.findUnique({ where: { id }, include: { lignes: true } });
    if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
    if (f.statut !== "BROUILLON") throw new ApiError(409, "Seul un brouillon peut être modifié", "STATUT_INVALIDE");
    const pieceIds = [...new Set(input.lignes.flatMap((l) => (l.pieceId ? [l.pieceId] : [])))];
    const pieces = await tx.piece.findMany({ where: { id: { in: pieceIds } }, select: { id: true, prixAchatHT: true } });
    if (pieces.length !== pieceIds.length) throw new ApiError(400, "Une pièce du stock est introuvable", "PIECE_INTROUVABLE");
    const achat = new Map(pieces.map((p) => [p.id, p.prixAchatHT]));
    const existantes = new Map(f.lignes.map((l) => [l.id, l]));
    await tx.ligneFacture.deleteMany({ where: { factureId: id } });
    await tx.facture.update({
      where: { id },
      data: {
        ...(input.dateEcheance ? { dateEcheance: new Date(`${input.dateEcheance}T12:00:00Z`) } : {}),
        ...totauxEtRemise(calculerTotaux(input.lignes), input),
        lignes: {
          create: input.lignes.map((l, i) => {
            const avant = l.id ? existantes.get(l.id) : undefined;
            return {
              type: l.type,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaireHT: l.prixUnitaireHT,
              prixCatalogueHT: l.type === "PIECE" ? (l.prixCatalogueHT ?? null) : null,
              tvaRate: l.tvaRate,
              totalHT: totalLigneHT(l),
              prixAchatHT: l.pieceId ? (achat.get(l.pieceId) ?? null) : null,
              pieceId: l.type === "PIECE" ? (l.pieceId ?? null) : null,
              // Les pièces d'un forfait ne suivent que la ligne d'origine (jamais fournies par le client).
              composition: l.type === "FORFAIT" && avant?.type === "FORFAIT" ? ((avant.composition as Prisma.InputJsonValue | null) ?? undefined) : undefined,
              position: i,
            };
          }),
        },
      },
    });
    return { id };
  });
}

/**
 * Émission d'un brouillon : le stock est ajusté de l'écart avec le devis (déjà décrémenté à sa validation),
 * puis la facture reçoit son numéro légal, l'OR passe en « Facturé » et la fiche de contrôle en « Traitée ».
 */
export async function emettreBrouillon(id: string, userId: string) {
  const facture = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Facture" WHERE id = ${id} FOR UPDATE`;
    const f = await tx.facture.findUnique({ where: { id }, include: { client: true, lignes: true, devis: { include: { lignes: true, ordre: { select: { id: true } } } } } });
    if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
    if (f.statut !== "BROUILLON") throw new ApiError(409, "Cette facture est déjà émise", "STATUT_INVALIDE");

    const qte = (ls: { type: string; pieceId: string | null; quantite: unknown; composition: unknown }[]) =>
      quantitesParPiece(ls.map((l) => ({ type: l.type, pieceId: l.pieceId, quantite: Number(l.quantite), composition: l.composition })));
    const avant = qte(f.devis?.lignes ?? []);
    const apres = qte(f.lignes);
    const ecarts = [...new Set([...avant.keys(), ...apres.keys()])].sort().map((pieceId) => ({ pieceId, delta: (apres.get(pieceId) ?? 0) - (avant.get(pieceId) ?? 0) }));
    const penurie: { reference: string; nom: string; demande: number; disponible: number }[] = [];
    for (const { pieceId, delta } of ecarts) {
      if (delta < 0) await tx.piece.update({ where: { id: pieceId }, data: { stock: { increment: -delta } } });
      if (delta > 0) {
        const r = await tx.piece.updateMany({ where: { id: pieceId, stock: { gte: delta } }, data: { stock: { decrement: delta } } });
        if (r.count === 0) {
          const p = await tx.piece.findUnique({ where: { id: pieceId }, select: { reference: true, nom: true, stock: true } });
          penurie.push({ reference: p?.reference ?? "?", nom: p?.nom ?? "Pièce", demande: delta, disponible: p?.stock ?? 0 });
        }
      }
    }
    if (penurie.length) throw new ApiError(409, "Stock insuffisant pour les pièces ajoutées", "STOCK_INSUFFISANT", penurie);
    await verifierReapprovisionnement(tx, ecarts.filter((e) => e.delta > 0).map((e) => e.pieceId));

    const now = new Date();
    const numero = await prochainNumero(tx, "FACTURE", now);
    const echeance = f.dateEcheance.getTime() > now.getTime() ? f.dateEcheance : ajouterJours(now, f.client.paymentTerms ?? 30);
    await tx.facture.update({ where: { id }, data: { numero, statut: "EMISE", dateEmission: now, dateEcheance: echeance, userId } });
    if (f.devis?.ordre) await cloturerOrdre(tx, f.devis.ordre.id, userId);
    return { id, numero };
  });
  await transmettreFacture(facture.id);
  return facture;
}

/** Transforme un devis validé en facture : recopie des lignes, totaux, échéance, numérotation. */
export async function creerFactureDepuisDevis(devisId: string, userId?: string, opts?: OptionsFacture) {
  const facture = await db.$transaction(async (tx) => {
    const devis = await tx.devis.findUnique({
      where: { id: devisId },
      include: { client: true, lignes: { orderBy: { position: "asc" }, include: { piece: { select: { prixAchatHT: true } } } }, facture: { select: { id: true } }, ordre: true, bonLivraison: { select: { id: true, factureId: true } } },
    });
    if (!devis) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
    if (devis.statut !== "VALIDE") throw new ApiError(409, "Seul un devis validé peut être facturé", "STATUT_INVALIDE");
    if (devis.facture || devis.bonLivraison?.factureId) throw new ApiError(409, "Ce devis est déjà facturé", "DEJA_FACTURE");

    const now = new Date();
    const numero = await prochainNumero(tx, "FACTURE", now);
    const f = await tx.facture.create({
      data: {
        numero,
        devisId: devis.id,
        userId: userId ?? null,
        clientId: devis.clientId,
        dateEmission: now,
        dateEcheance: ajouterJours(now, devis.client.paymentTerms ?? 30),
        remisePro: devis.remisePro,
        ...totauxEtRemise({ totalHT: Number(devis.totalHT), totalTVA: Number(devis.totalTVA), totalTTC: Number(devis.totalTTC) }, opts),
        statut: "EMISE",
        kilometrage: devis.ordre?.kilometrage ?? devis.kilometrage,
        lignes: { create: devis.lignes.map(copieLigneDevis) },
      },
    });
    // Le bon de livraison du devis est rattaché à la facture (il ne pourra plus être regroupé ailleurs).
    if (devis.bonLivraison) await tx.bonLivraison.update({ where: { id: devis.bonLivraison.id }, data: { factureId: f.id } });
    if (devis.ordre) await cloturerOrdre(tx, devis.ordre.id, userId);
    return f;
  });
  await transmettreFacture(facture.id); // hors transaction : un échec de la PA ne bloque pas la facture
  return { id: facture.id, numero: facture.numero };
}

/**
 * Facture unique regroupant plusieurs bons de livraison « Livré » du même client.
 * Lignes et prix : ceux du devis de chaque bon ; un bon créé à la main (sans devis) utilise le prix de vente
 * actuel des pièces (remise professionnelle comprise). Un bon ne peut être facturé qu'une fois.
 */
export async function creerFactureDepuisBons(bonLivraisonIds: string[], userId: string, opts?: OptionsFacture) {
  const ids = [...new Set(bonLivraisonIds)];
  const facture = await db.$transaction(async (tx) => {
    const bons = await tx.bonLivraison.findMany({
      where: { id: { in: ids } },
      orderBy: { numero: "asc" },
      include: {
        client: true,
        lignes: { include: { piece: { select: { prixVenteHT: true, prixAchatHT: true } } } },
        devis: { include: { facture: { select: { id: true } }, lignes: { orderBy: { position: "asc" }, include: { piece: { select: { prixAchatHT: true } } } } } },
      },
    });
    if (bons.length !== ids.length) throw new ApiError(404, "Bon de livraison introuvable", "INTROUVABLE");
    const client = bons[0].client;
    if (!client || client.anonymiseLe || bons.some((b) => b.clientId !== client.id)) {
      throw new ApiError(400, "Les bons de livraison doivent appartenir au même client", "CLIENTS_DIFFERENTS");
    }
    for (const b of bons) {
      if (b.statut !== "LIVREE") throw new ApiError(409, `${b.numero} n'est pas encore livré`, "NON_LIVRE");
      if (b.factureId || b.devis?.facture) throw new ApiError(409, `${b.numero} est déjà facturé`, "DEJA_FACTURE");
    }

    const remise = client.type === "PRO" ? Number(client.discountRate) : 0;
    const lignes: { type: "MAIN_OEUVRE" | "FORFAIT" | "PIECE" | "FRAIS_DIVERS"; designation: string; quantite: number; prixUnitaireHT: number; prixCatalogueHT: number | null; tvaRate: number; prixAchatHT: number | null; pieceId: string | null; composition?: Prisma.InputJsonValue }[] = [];
    for (const b of bons) {
      if (b.devis) {
        for (const l of b.devis.lignes) {
          lignes.push({ type: l.type, designation: l.designation, quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null, tvaRate: Number(l.tvaRate), prixAchatHT: l.piece ? Number(l.piece.prixAchatHT) : null, pieceId: l.pieceId, composition: (l.composition as Prisma.InputJsonValue | null) ?? undefined });
        }
      } else {
        for (const l of b.lignes) {
          const vente = l.piece ? Number(l.piece.prixVenteHT) : 0;
          lignes.push({ type: "PIECE", designation: l.designation || "Pièce", quantite: l.quantite, prixUnitaireHT: appliquerRemisePro(vente, remise), prixCatalogueHT: remise > 0 ? vente : null, tvaRate: 20, prixAchatHT: l.piece ? Number(l.piece.prixAchatHT) : null, pieceId: l.pieceId });
        }
      }
    }
    const totaux = calculerTotaux(lignes);
    const now = new Date();
    const numero = await prochainNumero(tx, "FACTURE", now);
    const f = await tx.facture.create({
      data: {
        numero,
        userId,
        clientId: client.id,
        dateEmission: now,
        dateEcheance: ajouterJours(now, client.paymentTerms ?? 30),
        remisePro: remise,
        ...totauxEtRemise(totaux, opts),
        statut: "EMISE",
        lignes: { create: lignes.map((l, i) => ({ ...l, totalHT: totalLigneHT(l), position: i })) },
      },
    });
    const r = await tx.bonLivraison.updateMany({ where: { id: { in: ids }, factureId: null }, data: { factureId: f.id } });
    if (r.count !== ids.length) throw new ApiError(409, "Un bon de livraison vient d'être facturé", "DEJA_FACTURE");
    return f;
  });
  await transmettreFacture(facture.id);
  return { id: facture.id, numero: facture.numero };
}

/**
 * Facture saisie directement, sans devis ni bon de livraison. Les pièces du stock décrémentent le stock
 * (décrément conditionnel : jamais de stock négatif) et peuvent déclencher le réapprovisionnement automatique.
 */
export async function creerFactureManuelle(userId: string, input: { clientId: string; dateEcheance?: string; lignes: LigneInput[] } & OptionsFacture) {
  const facture = await db.$transaction(async (tx) => {
    const client = await tx.client.findUnique({ where: { id: input.clientId } });
    if (!client || client.anonymiseLe) throw new ApiError(404, "Client introuvable", "INTROUVABLE");

    // Prix d'achat tracé pour l'analyse des marges ; stock décrémenté pour chaque pièce du stock.
    const demandes = new Map<string, number>();
    for (const l of input.lignes) if (l.pieceId) demandes.set(l.pieceId, (demandes.get(l.pieceId) ?? 0) + l.quantite);
    const pieces = await tx.piece.findMany({ where: { id: { in: [...demandes.keys()] } }, select: { id: true, nom: true, reference: true, prixAchatHT: true } });
    if (pieces.length !== demandes.size) throw new ApiError(400, "Une pièce du stock est introuvable", "PIECE_INTROUVABLE");
    const penurie: { reference: string; nom: string; demande: number; disponible: number }[] = [];
    for (const p of pieces) {
      const qte = demandes.get(p.id)!;
      const r = await tx.piece.updateMany({ where: { id: p.id, stock: { gte: qte } }, data: { stock: { decrement: qte } } });
      if (r.count === 0) {
        const courant = await tx.piece.findUnique({ where: { id: p.id }, select: { stock: true } });
        penurie.push({ reference: p.reference, nom: p.nom, demande: qte, disponible: courant?.stock ?? 0 });
      }
    }
    if (penurie.length) throw new ApiError(409, "Stock insuffisant", "STOCK_INSUFFISANT", penurie);
    await verifierReapprovisionnement(tx, [...demandes.keys()]);

    const achat = new Map(pieces.map((p) => [p.id, Number(p.prixAchatHT)]));
    const now = new Date();
    const echeance = input.dateEcheance ? new Date(`${input.dateEcheance}T12:00:00Z`) : ajouterJours(now, client.paymentTerms ?? 30);
    const remisePro = client.type === "PRO" ? Number(client.discountRate) : 0;
    const numero = await prochainNumero(tx, "FACTURE", now);
    return tx.facture.create({
      data: {
        numero,
        userId,
        clientId: client.id,
        manuelle: true,
        dateEmission: now,
        dateEcheance: echeance,
        remisePro: input.lignes.some((l) => l.prixCatalogueHT != null) ? remisePro : 0,
        ...totauxEtRemise(calculerTotaux(input.lignes), input),
        statut: "EMISE",
        lignes: {
          create: input.lignes.map((l, i) => ({
            type: l.type,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaireHT: l.prixUnitaireHT,
            prixCatalogueHT: l.type === "PIECE" ? (l.prixCatalogueHT ?? null) : null,
            tvaRate: l.tvaRate,
            totalHT: totalLigneHT(l),
            prixAchatHT: l.pieceId ? (achat.get(l.pieceId) ?? null) : null,
            pieceId: l.pieceId ?? null,
            position: i,
          })),
        },
      },
    });
  });
  await transmettreFacture(facture.id);
  return { id: facture.id, numero: facture.numero };
}

/** Transmission à la Plateforme Agréée (ou mock) et traçage du statut. */
export async function transmettreFacture(id: string) {
  const f = await db.facture.findUnique({ where: { id }, include: { client: true, lignes: { orderBy: { position: "asc" } } } });
  if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
  if (!f.numero) throw new ApiError(409, "Un brouillon n'est pas transmis : émettez d'abord la facture", "BROUILLON");
  let statutPA: string;
  try {
    const r = await getFactureProvider().envoyer({
      id: f.id,
      numero: f.numero,
      dateEmission: f.dateEmission,
      dateEcheance: f.dateEcheance,
      totalHT: Number(f.totalHT),
      totalTVA: Number(f.totalTVA),
      totalTTC: Number(f.totalTTC),
      client: { nom: nomClient(f.client), siret: f.client.siret, tvaNumber: f.client.tvaNumber },
      lignes: f.lignes.map((l) => ({ designation: l.designation, quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), tvaRate: Number(l.tvaRate), totalHT: Number(l.totalHT) })),
    });
    statutPA = r.statut;
  } catch {
    statutPA = "ERREUR : transmission impossible";
  }
  await db.facture.update({ where: { id }, data: { statutPA } });
  return { statutPA };
}

export interface PaiementInput {
  montant: number;
  mode: "CB" | "ESPECES" | "CHEQUE" | "VIREMENT" | "PLUSIEURS_FOIS";
  nombreFois?: number | null;
  reference?: string | null;
  datePaiement?: Date;
}

/** Enregistre un paiement et recalcule le statut, sous verrou de ligne (pas de double paiement concurrent). */
export async function enregistrerPaiement(factureId: string, p: PaiementInput) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Facture" WHERE id = ${factureId} FOR UPDATE`;
    const f = await tx.facture.findUnique({ where: { id: factureId } });
    if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
    if (f.statut === "ANNULEE") throw new ApiError(409, "Cette facture est annulée", "STATUT_INVALIDE");
    if (f.statut === "BROUILLON") throw new ApiError(409, "Émettez la facture avant d'enregistrer un paiement", "STATUT_INVALIDE");

    const total = Number(f.totalTTC);
    const deja = Number(f.montantPaye);
    const reste = round2(total - deja);
    if (reste <= 0) throw new ApiError(409, "Cette facture est déjà soldée", "DEJA_PAYEE");
    if (p.montant > reste + 0.001) throw new ApiError(400, `Le montant dépasse le reste à payer (${reste.toFixed(2)} €)`, "MONTANT_INVALIDE");

    await tx.paiement.create({
      data: { factureId, montant: p.montant, mode: p.mode, nombreFois: p.mode === "PLUSIEURS_FOIS" ? (p.nombreFois ?? null) : null, reference: p.reference || null, datePaiement: p.datePaiement ?? new Date() },
    });
    const montantPaye = round2(deja + p.montant);
    const statut = calculerStatutFacture({ totalTTC: total, montantPaye, dateEcheance: f.dateEcheance });
    await tx.facture.update({ where: { id: factureId }, data: { montantPaye, statut } });
    return { id: factureId, statut, montantPaye, reste: round2(total - montantPaye) };
  });
}

export async function annulerFacture(id: string) {
  const f = await db.facture.findUnique({ where: { id }, select: { montantPaye: true, statut: true, manuelle: true, lignes: { select: { pieceId: true, quantite: true } } } });
  if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
  if (f.statut === "ANNULEE") return { id };
  if (f.statut === "BROUILLON") throw new ApiError(409, "Un brouillon n'est pas émis : il ne peut pas être annulé", "STATUT_INVALIDE");
  if (Number(f.montantPaye) > 0) throw new ApiError(409, "Une facture avec des paiements ne peut pas être annulée", "PAIEMENTS_EXISTANTS");
  await db.$transaction(async (tx) => {
    // Le changement de statut est conditionnel : deux annulations simultanées ne restituent le stock qu'une fois.
    const r = await tx.facture.updateMany({ where: { id, statut: { not: "ANNULEE" } }, data: { statut: "ANNULEE" } });
    if (r.count === 0) return;
    // Une facture manuelle a décrémenté le stock : on le restitue.
    if (f.manuelle) {
      for (const l of f.lignes) if (l.pieceId) await tx.piece.update({ where: { id: l.pieceId }, data: { stock: { increment: Number(l.quantite) } } });
    }
  });
  return { id };
}

/** Recalcule les statuts (passage en IMPAYEE des factures échues). */
export async function rafraichirStatuts(now = new Date()) {
  const ouvertes = await db.facture.findMany({ where: { statut: { in: ["EMISE", "PARTIELLEMENT_PAYEE", "IMPAYEE"] } } });
  let modifiees = 0;
  for (const f of ouvertes) {
    const s = calculerStatutFacture({ totalTTC: Number(f.totalTTC), montantPaye: Number(f.montantPaye), dateEcheance: f.dateEcheance, statut: f.statut }, now);
    if (s !== f.statut) {
      await db.facture.update({ where: { id: f.id }, data: { statut: s } });
      modifiees++;
    }
  }
  return modifiees;
}

/** Rapport hebdomadaire des impayés envoyé à l'admin et au secrétariat. Idempotent par semaine ISO. */
export async function envoyerRapportImpayes(now = new Date()) {
  await rafraichirStatuts(now);
  const impayees = await db.facture.findMany({
    where: { statut: "IMPAYEE" },
    orderBy: { dateEcheance: "asc" },
    include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } } },
  });
  const params = await db.parametreGarage.findUnique({ where: { id: 1 } });
  const destinataires = await db.user.findMany({ where: { isActive: true, role: { in: ["ADMIN", "SECRETARIAT"] } }, select: { email: true } });
  const semaine = `${now.getUTCFullYear()}-S${Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)}`;

  if (impayees.length === 0) return { factures: 0, envoyes: 0 };
  const mail = emailRecapImpayes({
    garage: params?.nomGarage ?? "Garage",
    lignes: impayees.map((f) => ({
      numero: f.numero ?? "",
      client: nomClient(f.client),
      reste: round2(Number(f.totalTTC) - Number(f.montantPaye)),
      joursRetard: Math.max(1, Math.floor((now.getTime() - f.dateEcheance.getTime()) / 864e5)),
    })),
  });
  let envoyes = 0;
  for (const d of destinataires) {
    const r = await envoyerEmail({ cle: `impayes:${semaine}:${d.email}`, template: "recap_impayes", destinataire: d.email, subject: mail.subject, html: mail.html });
    if (r === "envoye" || r === "simulation") envoyes++;
  }
  return { factures: impayees.length, envoyes };
}
