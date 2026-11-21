import "server-only";
import { db } from "@/lib/db";
import { lireComposition, libelleComposition } from "@/lib/composition";
import type { PdfDocData, PdfLigne } from "@/lib/pdf/document";
import { fromCents, montantsLigne, prixUnitaireTTC, toCents } from "@/lib/money";
import { tauxRemiseLigne } from "@/lib/remise";
import { lireLogo } from "@/lib/logo";
import { LIBELLES_MODE, MENTIONS_FACTURE_DEFAUT } from "@/lib/validators/parametres";

const eur = (n: number) => n.toFixed(2).replace(".", ",");
const nb = (n: number) => String(n).replace(".", ",");

/** Coordonnées et logo du garage (onglet « Mon Garage ») pour l'en-tête des PDF. null si les paramètres manquent. */
export async function garagePdf(): Promise<
  | (PdfDocData["garage"] & { iban: string | null; bic: string | null; affichageRemise: AffichageRemise; mentionsFacture: string; modesPaiement: string[] })
  | null
> {
  const g = await db.parametreGarage.findUnique({ where: { id: 1 } });
  if (!g) return null;
  const l = await lireLogo();
  const logo = l ? { bytes: new Uint8Array(l.bytes), format: l.mime === "image/png" ? ("png" as const) : ("jpg" as const) } : undefined;
  const capital = g.capitalSocial ? `au capital de ${g.capitalSocial}` : "";
  const mentions = [[g.formeJuridique, capital].filter(Boolean).join(" "), g.rcs].filter(Boolean).join(" · ") || undefined;
  return {
    nom: g.nomGarage, adresse: g.adresse, telephone: g.telephone, email: g.email, siret: g.siret, tva: g.tvaNumber, mentions, logo, iban: g.iban, bic: g.bic,
    // Paramètres › Facturation.
    affichageRemise: g.affichageRemise,
    mentionsFacture: g.mentionsFacture?.trim() || MENTIONS_FACTURE_DEFAUT,
    modesPaiement: g.modesPaiement.map((m) => LIBELLES_MODE[m]),
  };
}

interface LigneSource {
  type: string;
  designation: string;
  quantite: unknown;
  prixUnitaireHT: unknown;
  prixUnitaireTTC?: unknown;
  prixCatalogueHT: unknown;
  tvaRate: unknown;
  totalHT: unknown;
  pieceId: string | null;
  composition?: unknown;
}

/** Affichage de la remise professionnelle sur les PDF (Paramètres › Facturation). */
export type AffichageRemise = "LIGNE" | "TOTAL" | "MASQUER";

/**
 * Lignes de devis / facture avec les mentions obligatoires de la réparation automobile :
 * désignation précise et référence des pièces, temps facturé et taux horaire de la main d'œuvre,
 * pièces comprises dans les forfaits.
 * Remise professionnelle selon `affichage` : « LIGNE » prix catalogue et taux sous la ligne ; « TOTAL » ligne au prix
 * catalogue, la remise étant déduite dans les totaux (voir `remiseProTotal`) ; « MASQUER » prix net sans mention.
 */
export async function lignesPdf(lignes: LigneSource[], affichage: AffichageRemise = "LIGNE"): Promise<PdfLigne[]> {
  const ids = [...new Set(lignes.flatMap((l) => (l.pieceId ? [l.pieceId] : [])))];
  const refs = new Map((await db.piece.findMany({ where: { id: { in: ids } }, select: { id: true, reference: true } })).map((p) => [p.id, p.reference]));
  return lignes.map((l) => {
    const quantite = Number(l.quantite);
    const pu = Number(l.prixUnitaireHT);
    const calcul = { quantite, prixUnitaireHT: pu, prixUnitaireTTC: l.prixUnitaireTTC != null ? Number(l.prixUnitaireTTC) : null, tvaRate: Number(l.tvaRate) };
    const cat = l.prixCatalogueHT != null ? Number(l.prixCatalogueHT) : null;
    const taux = tauxRemiseLigne({ prixUnitaireHT: pu, prixCatalogueHT: cat });
    const detail: string[] = [];
    if (l.type === "PIECE") {
      const ref = l.pieceId ? refs.get(l.pieceId) : undefined;
      if (ref && !l.designation.toUpperCase().includes(ref.toUpperCase())) detail.push(`Pièce réf. ${ref}`);
      if (taux > 0 && affichage === "LIGNE") detail.push(`Prix catalogue ${eur(cat!)} EUR HT, remise professionnelle ${nb(taux)} %`);
    }
    if (l.type === "MAIN_OEUVRE") detail.push(`Main d'oeuvre : temps facturé ${nb(quantite)} h au taux horaire de ${eur(pu)} EUR HT`);
    if (l.type === "FORFAIT") {
      detail.push("Prestation au prix forfaitaire");
      const pieces = libelleComposition(lireComposition(l.composition), quantite);
      if (pieces) detail.push(pieces);
    }
    if (taux > 0 && affichage === "TOTAL") {
      // Ligne au prix catalogue : la remise apparaît dans les totaux.
      const brut = { quantite, prixUnitaireHT: cat!, prixUnitaireTTC: null, tvaRate: Number(l.tvaRate) };
      const m = montantsLigne(brut);
      return { designation: l.designation, quantite, prixUnitaireHT: cat!, tvaRate: Number(l.tvaRate), totalHT: m.totalHT, prixUnitaireTTC: prixUnitaireTTC(brut), totalTTC: m.totalTTC, detail: detail.length ? detail : undefined };
    }
    return {
      designation: l.designation,
      quantite,
      unite: l.type === "MAIN_OEUVRE" ? "h" : undefined,
      prixUnitaireHT: pu,
      tvaRate: Number(l.tvaRate),
      totalHT: Number(l.totalHT),
      prixUnitaireTTC: prixUnitaireTTC(calcul),
      totalTTC: montantsLigne(calcul).totalTTC,
      detail: detail.length ? detail : undefined,
    };
  });
}

/** Bloc véhicule : modèle, immatriculation et kilométrage (mentions obligatoires sur devis et factures). */
export function vehiculePdf(v: { marque: string; modele: string; immatriculation: string } | null | undefined, kilometrage: number | null | undefined): PdfDocData["vehicule"] {
  if (!v) return null;
  return { libelle: `${v.marque} ${v.modele}`, immatriculation: v.immatriculation, kilometrage: kilometrage ?? null };
}

/**
 * Mode « TOTAL » : total HT brut des lignes (pièces au prix catalogue) et montant HT de la remise PRO,
 * calculés sur les montants imprimés pour que « Total HT brut − Remise PRO » retombe exactement sur le total HT des lignes.
 */
export function remiseProTotal(lignes: LigneSource[]): { totalHTBrut: number; montant: number } | undefined {
  let brut = 0;
  let net = 0;
  for (const l of lignes) {
    const quantite = Number(l.quantite);
    const pu = Number(l.prixUnitaireHT);
    const cat = l.prixCatalogueHT != null ? Number(l.prixCatalogueHT) : null;
    const ht = toCents(Number(l.totalHT));
    net += ht;
    brut += tauxRemiseLigne({ prixUnitaireHT: pu, prixCatalogueHT: cat }) > 0 ? toCents(montantsLigne({ quantite, prixUnitaireHT: cat!, prixUnitaireTTC: null, tvaRate: Number(l.tvaRate) }).totalHT) : ht;
  }
  return brut > net ? { totalHTBrut: fromCents(brut), montant: fromCents(brut - net) } : undefined;
}
