import "server-only";
import { db, type Tx } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { Prisma, TypeLigne } from "@/generated/prisma/client";
import { lireComposition, type PieceComprise } from "@/lib/composition";
import { calculerTotaux, totalLigneHT } from "@/lib/money";
import { prochainNumero } from "@/lib/numbering";
import { verifierReapprovisionnement } from "@/lib/services/reappro";
import { enregistrerRdvTx } from "@/lib/services/rdv";
import { canSeeMargins, type PermissionUser } from "@/lib/permissions";
import type { DevisInput } from "@/lib/validators/devis";

export interface PenurieStock {
  pieceId: string;
  reference: string;
  nom: string;
  demande: number;
  disponible: number;
}

function stockInsuffisant(penuries: PenurieStock[]) {
  return new ApiError(409, "Stock insuffisant pour valider ce devis", "STOCK_INSUFFISANT", penuries);
}

/** Quantités demandées par pièce : lignes PIECE liées au stock + pièces comprises dans les forfaits (× quantité du forfait). */
export function quantitesParPiece(lignes: { type: TypeLigne | string; pieceId?: string | null; quantite: number; composition?: unknown }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lignes) {
    if (l.type === "PIECE" && l.pieceId) m.set(l.pieceId, (m.get(l.pieceId) ?? 0) + l.quantite);
    if (l.type === "FORFAIT") for (const p of lireComposition(l.composition)) m.set(p.pieceId, (m.get(p.pieceId) ?? 0) + p.quantite * l.quantite);
  }
  return m;
}

/**
 * Pièces comprises dans les forfaits du devis, lues dans les tarifs (jamais fournies par le client) et figées sur la ligne.
 * Clé : index de la ligne. Un forfait qui contient des pièces doit avoir une quantité entière.
 */
async function compositions(tx: Tx, input: DevisInput): Promise<Map<number, PieceComprise[]>> {
  const ids = [...new Set(input.lignes.flatMap((l) => (l.type === "FORFAIT" && l.tarifId ? [l.tarifId] : [])))];
  const out = new Map<number, PieceComprise[]>();
  if (ids.length === 0) return out;
  const tarifs = await tx.tarif.findMany({ where: { id: { in: ids } }, include: { pieces: { include: { piece: { select: { reference: true, nom: true } } }, orderBy: { id: "asc" } } } });
  const parId = new Map(tarifs.map((t) => [t.id, t.pieces.map((p) => ({ pieceId: p.pieceId, reference: p.piece.reference, nom: p.piece.nom, quantite: p.quantite }))]));
  input.lignes.forEach((l, i) => {
    const pieces = l.type === "FORFAIT" && l.tarifId ? (parId.get(l.tarifId) ?? []) : [];
    if (pieces.length === 0) return;
    if (!Number.isInteger(l.quantite)) throw new ApiError(400, `Le forfait « ${l.designation} » comprend des pièces : sa quantité doit être un nombre entier`, "QUANTITE_INVALIDE");
    out.set(i, pieces);
  });
  return out;
}

/** Détecte les pièces dont la quantité demandée dépasse le stock disponible. */
export function calculerPenuries(
  demandes: Map<string, number>,
  pieces: { id: string; reference: string; nom: string; stock: number }[],
): PenurieStock[] {
  const out: PenurieStock[] = [];
  for (const p of pieces) {
    const demande = demandes.get(p.id) ?? 0;
    if (demande > p.stock) out.push({ pieceId: p.id, reference: p.reference, nom: p.nom, demande, disponible: p.stock });
  }
  return out;
}

async function verifierStock(tx: Tx, demandes: Map<string, number>) {
  if (demandes.size === 0) return;
  const pieces = await tx.piece.findMany({
    where: { id: { in: [...demandes.keys()] } },
    select: { id: true, reference: true, nom: true, stock: true, isActive: true },
  });
  if (pieces.length !== demandes.size || pieces.some((p) => !p.isActive)) {
    throw new ApiError(400, "Une pièce du devis n'existe plus ou est désactivée", "PIECE_INTROUVABLE");
  }
  const penuries = calculerPenuries(demandes, pieces);
  if (penuries.length) throw stockInsuffisant(penuries);
}

async function preparer(tx: Tx, input: DevisInput) {
  const client = await tx.client.findUnique({ where: { id: input.clientId } });
  if (!client || client.anonymiseLe || !client.isActive) throw new ApiError(400, "Client introuvable", "CLIENT_INTROUVABLE");
  if (input.vehiculeId) {
    const v = await tx.vehicule.findUnique({ where: { id: input.vehiculeId }, select: { clientId: true } });
    if (!v) throw new ApiError(400, "Véhicule introuvable", "VEHICULE_INVALIDE");
    if (v.clientId && v.clientId !== client.id) {
      throw new ApiError(400, "Ce véhicule est associé à un autre client. Changez son propriétaire depuis la fiche du véhicule.", "VEHICULE_INVALIDE");
    }
    // Véhicule sans propriétaire : le client du devis lui est associé. Kilométrage et date de CT sont mis à jour si saisis.
    await tx.vehicule.update({
      where: { id: input.vehiculeId },
      data: {
        ...(v.clientId ? {} : { clientId: client.id }),
        ...(input.kilometrage != null ? { kilometrage: input.kilometrage } : {}),
        ...(input.prochainCT ? { prochainCT: new Date(`${input.prochainCT}T12:00:00Z`) } : {}),
      },
    });
  }
  // Une pièce ne peut être ajoutée au devis que si la quantité demandée est en stock (pièces des forfaits comprises).
  const compos = await compositions(tx, input);
  await verifierStock(tx, quantitesParPiece(input.lignes.map((l, i) => ({ ...l, composition: compos.get(i) }))));

  const totaux = calculerTotaux(input.lignes);
  const remisePro = client.type === "PRO" ? Number(client.discountRate) : 0;
  return { client, totaux, remisePro, compos };
}

function lignesData(input: DevisInput, compos: Map<number, PieceComprise[]>) {
  return input.lignes.map((l, i) => ({
    type: l.type,
    designation: l.designation,
    quantite: l.quantite,
    prixUnitaireHT: l.prixUnitaireHT,
    // La réduction ne concerne que les pièces : on ne garde un prix catalogue que sur ces lignes.
    prixCatalogueHT: l.type === "PIECE" && l.prixCatalogueHT != null && l.prixCatalogueHT > l.prixUnitaireHT ? l.prixCatalogueHT : null,
    tvaRate: l.tvaRate,
    totalHT: totalLigneHT(l),
    pieceId: l.type === "PIECE" ? (l.pieceId ?? null) : null,
    tarifId: l.type === "FORFAIT" ? (l.tarifId ?? null) : null,
    composition: (compos.get(i) as unknown as Prisma.InputJsonValue) ?? undefined,
    position: i,
  }));
}

function dateValidite(input: DevisInput): Date {
  if (input.dateValidite) return new Date(`${input.dateValidite}T12:00:00Z`);
  return new Date(Date.now() + 30 * 24 * 3600 * 1000);
}

export async function creerDevis(userId: string, input: DevisInput) {
  return db.$transaction(async (tx) => {
    const { totaux, remisePro, compos } = await preparer(tx, input);
    const numero = await prochainNumero(tx, "DEVIS");
    const devis = await tx.devis.create({
      data: {
        numero,
        type: input.type,
        clientId: input.clientId,
        vehiculeId: input.vehiculeId ?? null,
        userId,
        statut: "BROUILLON", // « Envoyé » seulement après un envoi par e-mail réussi
        kilometrage: input.kilometrage ?? null,
        dateValidite: dateValidite(input),
        remisePro,
        ...totaux,
        lignes: { create: lignesData(input, compos) },
      },
    });
    return { id: devis.id, numero };
  });
}

export async function modifierDevis(id: string, input: DevisInput) {
  return db.$transaction(async (tx) => {
    const existant = await tx.devis.findUnique({ where: { id }, select: { statut: true } });
    if (!existant) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
    if (existant.statut !== "ENVOYE" && existant.statut !== "BROUILLON") throw new ApiError(409, "Un devis validé ou rejeté ne peut plus être modifié", "STATUT_INVALIDE");
    const { totaux, remisePro, compos } = await preparer(tx, input);
    await tx.ligneDevis.deleteMany({ where: { devisId: id } });
    await tx.devis.update({
      where: { id },
      data: {
        type: input.type,
        clientId: input.clientId,
        vehiculeId: input.vehiculeId ?? null,
        kilometrage: input.kilometrage ?? null,
        dateValidite: dateValidite(input),
        remisePro,
        ...totaux,
        lignes: { create: lignesData(input, compos) },
      },
    });
    return { id };
  });
}

export async function rejeterDevis(id: string, motif: string) {
  const r = await db.devis.updateMany({ where: { id, statut: { in: ["ENVOYE", "BROUILLON"] } }, data: { statut: "REJETE", motifRejet: motif } });
  if (r.count === 0) throw new ApiError(409, "Seul un devis envoyé peut être rejeté", "STATUT_INVALIDE");
}

export interface ValidationInput {
  mecanicienId?: string | null;
  rdv?: { debut: string; fin: string } | null;
}

/**
 * Validation transactionnelle (tout ou rien) :
 *  1. contrôle du stock de chaque pièce → 409 + détail si insuffisant ;
 *  2. décrémentation atomique du stock, puis bon de commande automatique pour les pièces au seuil d'alerte ;
 *  3. devis mécanique : rendez-vous au planning (technicien + créneau obligatoires, conflit → refus) et création de l'OR ;
 *     devis pièces : création du bon de livraison « en attente » ;
 *  4. passage du devis en VALIDE.
 */
export async function validerDevis(id: string, input: ValidationInput = {}) {
  return db.$transaction(async (tx) => {
    const devis = await tx.devis.findUnique({ where: { id }, include: { lignes: { orderBy: { position: "asc" } }, client: true } });
    if (!devis) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
    if (devis.statut !== "ENVOYE" && devis.statut !== "BROUILLON") throw new ApiError(409, "Ce devis ne peut pas être validé", "STATUT_INVALIDE");

    const mecanique = devis.type === "MECANIQUE";
    if (mecanique) {
      if (!input.mecanicienId) throw new ApiError(400, "Choisissez le technicien", "TECHNICIEN_REQUIS");
      if (!input.rdv) throw new ApiError(400, "Indiquez la date et l'heure du rendez-vous", "RDV_REQUIS");
      if (!devis.vehiculeId) throw new ApiError(400, "Ce devis n'a pas de véhicule", "VEHICULE_REQUIS");
      const m = await tx.user.findUnique({ where: { id: input.mecanicienId }, select: { role: true, isActive: true } });
      if (!m || !m.isActive || m.role !== "MECANICIEN") throw new ApiError(400, "Technicien invalide", "MECANICIEN_INVALIDE");
    }

    const demandes = quantitesParPiece(devis.lignes.map((l) => ({ type: l.type, pieceId: l.pieceId, quantite: Number(l.quantite), composition: l.composition })));
    await verifierStock(tx, demandes);

    // Décrémentation atomique conditionnelle (ordre déterministe : pas d'interblocage).
    for (const [pieceId, qte] of [...demandes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const n = await tx.$executeRaw`UPDATE "Piece" SET stock = stock - ${qte}, "updatedAt" = NOW() WHERE id = ${pieceId} AND stock >= ${qte}`;
      if (n === 0) {
        // Stock consommé par une validation concurrente entre le contrôle et la mise à jour.
        const p = await tx.piece.findUniqueOrThrow({ where: { id: pieceId }, select: { reference: true, nom: true, stock: true } });
        throw stockInsuffisant([{ pieceId, reference: p.reference, nom: p.nom, demande: qte, disponible: p.stock }]);
      }
    }
    const reappro = await verifierReapprovisionnement(tx, [...demandes.keys()]);

    let ordre: { id: string; numero: string } | null = null;
    let bonLivraison: { id: string; numero: string } | null = null;
    let rdvId: string | null = null;

    if (mecanique) {
      const rdv = await enregistrerRdvTx(tx, {
        clientId: devis.clientId,
        vehiculeId: devis.vehiculeId!,
        userId: input.mecanicienId!,
        devisId: devis.id,
        debut: input.rdv!.debut,
        fin: input.rdv!.fin,
        motif: `Devis ${devis.numero}`,
      });
      rdvId = rdv.id;
      const numero = await prochainNumero(tx, "ORDRE");
      const taches = devis.lignes
        .filter((l) => l.type === "MAIN_OEUVRE" || l.type === "FORFAIT")
        .map((l, i) => ({ designation: l.designation, dureeHeures: l.type === "MAIN_OEUVRE" ? Number(l.quantite) : 0, position: i }));
      ordre = await tx.ordreReparation.create({
        data: { numero, devisId: devis.id, userId: input.mecanicienId!, taches: { create: taches } },
        select: { id: true, numero: true },
      });
    } else {
      const lignesBl = devis.lignes.filter((l) => l.type === "PIECE");
      if (lignesBl.length > 0) {
        const numero = await prochainNumero(tx, "BL");
        bonLivraison = await tx.bonLivraison.create({
          data: {
            numero,
            clientId: devis.clientId,
            devisId: devis.id,
            lignes: { create: lignesBl.map((l) => ({ pieceId: l.pieceId, designation: l.designation, quantite: Math.max(1, Math.round(Number(l.quantite))) })) },
          },
          select: { id: true, numero: true },
        });
      }
    }

    const r = await tx.devis.updateMany({ where: { id, statut: { in: ["ENVOYE", "BROUILLON"] } }, data: { statut: "VALIDE" } });
    if (r.count === 0) throw new ApiError(409, "Ce devis a déjà été traité", "STATUT_INVALIDE");
    return { id, ordre, bonLivraison, rdvId, reappro };
  });
}

/** Réservé à l'admin : remet un devis « Envoyé » (restaure le stock, retire l'OR, le rendez-vous et le bon de livraison non traités). */
export async function rouvrirDevis(id: string) {
  return db.$transaction(async (tx) => {
    const devis = await tx.devis.findUnique({ where: { id }, include: { lignes: true, ordre: true, facture: { select: { id: true } }, bonLivraison: true } });
    if (!devis) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
    if (devis.statut === "ENVOYE" || devis.statut === "BROUILLON") return { id };
    if (devis.facture) throw new ApiError(409, "Ce devis est déjà facturé", "DEJA_FACTURE");
    if (devis.statut === "VALIDE") {
      if (devis.ordre && devis.ordre.statut !== "EN_ATTENTE_SIGNATURE") {
        throw new ApiError(409, "L'ordre de réparation est déjà signé ou en cours", "OR_EN_COURS");
      }
      if (devis.bonLivraison && (devis.bonLivraison.statut !== "EN_ATTENTE" || devis.bonLivraison.factureId)) {
        throw new ApiError(409, "Le bon de livraison est déjà préparé, livré ou facturé", "BL_PRET");
      }
      const demandes = quantitesParPiece(devis.lignes.map((l) => ({ type: l.type, pieceId: l.pieceId, quantite: Number(l.quantite), composition: l.composition })));
      for (const [pieceId, qte] of demandes) {
        await tx.$executeRaw`UPDATE "Piece" SET stock = stock + ${qte}, "updatedAt" = NOW() WHERE id = ${pieceId}`;
      }
      if (devis.ordre) await tx.ordreReparation.delete({ where: { id: devis.ordre.id } });
      if (devis.bonLivraison) await tx.bonLivraison.delete({ where: { id: devis.bonLivraison.id } });
      await tx.rendezVous.deleteMany({ where: { devisId: id, statut: { in: ["PLANIFIE", "CONFIRME"] } } });
    }
    await tx.devis.update({ where: { id }, data: { statut: "ENVOYE", motifRejet: null } });
    return { id };
  });
}

/** Lecture d'un devis avec marges visibles uniquement pour l'admin. */
export async function lireDevis(id: string, user: PermissionUser) {
  const d = await db.devis.findUnique({
    where: { id },
    include: {
      client: true,
      vehicule: true,
      user: { select: { firstName: true, lastName: true } },
      lignes: { orderBy: { position: "asc" }, include: { piece: { select: { reference: true, prixAchatHT: true, stock: true } } } },
      ordre: { select: { id: true, numero: true, statut: true } },
      facture: { select: { id: true, numero: true } },
      bonLivraison: { select: { id: true, numero: true, statut: true, factureId: true } },
    },
  });
  if (!d) return null;
  const marges = canSeeMargins(user);
  const lignes = d.lignes.map((l) => {
    const pu = Number(l.prixUnitaireHT);
    const achat = l.piece ? Number(l.piece.prixAchatHT) : null;
    return {
      id: l.id,
      type: l.type,
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaireHT: pu,
      prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null,
      tvaRate: Number(l.tvaRate),
      totalHT: Number(l.totalHT),
      pieceId: l.pieceId,
      reference: l.piece?.reference ?? null,
      stock: l.piece?.stock ?? null,
      tarifId: l.tarifId,
      piecesComprises: lireComposition(l.composition),
      ...(marges && achat !== null ? { prixAchatHT: achat, margeHT: Math.round((pu - achat) * Number(l.quantite) * 100) / 100 } : {}),
    };
  });
  return {
    id: d.id,
    numero: d.numero,
    type: d.type,
    statut: d.statut,
    motifRejet: d.motifRejet,
    dateCreation: d.dateCreation,
    dateValidite: d.dateValidite,
    remisePro: Number(d.remisePro),
    totalHT: Number(d.totalHT),
    totalTVA: Number(d.totalTVA),
    totalTTC: Number(d.totalTTC),
    client: d.client,
    vehicule: d.vehicule,
    auteur: `${d.user.firstName} ${d.user.lastName}`,
    kilometrage: d.kilometrage,
    ordre: d.ordre,
    facture: d.facture,
    bonLivraison: d.bonLivraison,
    lignes,
  };
}
