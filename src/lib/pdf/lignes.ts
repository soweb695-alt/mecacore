import "server-only";
import { db } from "@/lib/db";
import { lireComposition, libelleComposition } from "@/lib/composition";
import type { PdfDocData, PdfLigne } from "@/lib/pdf/document";
import { tauxRemiseLigne } from "@/lib/remise";
import { getFichier, typeImage } from "@/lib/storage";

const eur = (n: number) => n.toFixed(2).replace(".", ",");
const nb = (n: number) => String(n).replace(".", ",");

/** Coordonnées et logo du garage (onglet « Mon Garage ») pour l'en-tête des PDF. null si les paramètres manquent. */
export async function garagePdf(): Promise<(PdfDocData["garage"] & { iban: string | null; bic: string | null }) | null> {
  const g = await db.parametreGarage.findUnique({ where: { id: 1 } });
  if (!g) return null;
  const buf = g.logoUrl ? await getFichier(g.logoUrl).catch(() => null) : null;
  const type = buf ? typeImage(buf) : null;
  const logo = buf && (type?.mime === "image/png" || type?.mime === "image/jpeg") ? { bytes: new Uint8Array(buf), format: type.mime === "image/png" ? ("png" as const) : ("jpg" as const) } : undefined;
  return { nom: g.nomGarage, adresse: g.adresse, telephone: g.telephone, email: g.email, siret: g.siret, tva: g.tvaNumber, logo, iban: g.iban, bic: g.bic };
}

interface LigneSource {
  type: string;
  designation: string;
  quantite: unknown;
  prixUnitaireHT: unknown;
  prixCatalogueHT: unknown;
  tvaRate: unknown;
  totalHT: unknown;
  pieceId: string | null;
  composition?: unknown;
}

/**
 * Lignes de devis / facture avec les mentions obligatoires de la réparation automobile :
 * désignation précise et référence des pièces, temps facturé et taux horaire de la main d'œuvre,
 * pièces comprises dans les forfaits.
 */
export async function lignesPdf(lignes: LigneSource[]): Promise<PdfLigne[]> {
  const ids = [...new Set(lignes.flatMap((l) => (l.pieceId ? [l.pieceId] : [])))];
  const refs = new Map((await db.piece.findMany({ where: { id: { in: ids } }, select: { id: true, reference: true } })).map((p) => [p.id, p.reference]));
  return lignes.map((l) => {
    const quantite = Number(l.quantite);
    const pu = Number(l.prixUnitaireHT);
    const cat = l.prixCatalogueHT != null ? Number(l.prixCatalogueHT) : null;
    const taux = tauxRemiseLigne({ prixUnitaireHT: pu, prixCatalogueHT: cat });
    const detail: string[] = [];
    if (l.type === "PIECE") {
      const ref = l.pieceId ? refs.get(l.pieceId) : undefined;
      if (ref && !l.designation.toUpperCase().includes(ref.toUpperCase())) detail.push(`Pièce réf. ${ref}`);
      if (taux > 0) detail.push(`Prix catalogue ${eur(cat!)} EUR HT, remise professionnelle ${nb(taux)} %`);
    }
    if (l.type === "MAIN_OEUVRE") detail.push(`Main d'oeuvre : temps facturé ${nb(quantite)} h au taux horaire de ${eur(pu)} EUR HT`);
    if (l.type === "FORFAIT") {
      detail.push("Prestation au prix forfaitaire");
      const pieces = libelleComposition(lireComposition(l.composition), quantite);
      if (pieces) detail.push(pieces);
    }
    return {
      designation: l.designation,
      quantite,
      unite: l.type === "MAIN_OEUVRE" ? "h" : undefined,
      prixUnitaireHT: pu,
      tvaRate: Number(l.tvaRate),
      totalHT: Number(l.totalHT),
      detail: detail.length ? detail : undefined,
    };
  });
}

/** Bloc véhicule : modèle, immatriculation et kilométrage (mentions obligatoires sur devis et factures). */
export function vehiculePdf(v: { marque: string; modele: string; immatriculation: string } | null | undefined, kilometrage: number | null | undefined): PdfDocData["vehicule"] {
  if (!v) return null;
  return { libelle: `${v.marque} ${v.modele}`, immatriculation: v.immatriculation, kilometrage: kilometrage ?? null };
}
