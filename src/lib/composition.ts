// Pièces comprises dans un forfait (copie figée sur les lignes de devis et de facture). Module pur.

export interface PieceComprise {
  pieceId: string;
  reference: string;
  nom: string;
  /** Quantité pour un forfait (multipliée par la quantité de la ligne). */
  quantite: number;
}

/** Lecture tolérante du champ JSON `composition` (null, ancien format ou donnée invalide → liste vide). */
export function lireComposition(json: unknown): PieceComprise[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((p) =>
    p && typeof p === "object" && typeof p.pieceId === "string" && Number.isInteger(p.quantite) && p.quantite > 0
      ? [{ pieceId: p.pieceId, reference: String(p.reference ?? ""), nom: String(p.nom ?? ""), quantite: p.quantite as number }]
      : [],
  );
}

/** Mention imprimée sous la ligne du forfait : désignation précise des pièces fournies. */
export function libelleComposition(pieces: PieceComprise[], quantiteLigne = 1): string | undefined {
  if (pieces.length === 0) return undefined;
  return `Pièces comprises : ${pieces.map((p) => `${p.nom} (réf. ${p.reference}) × ${p.quantite * quantiteLigne}`).join(", ")}`;
}
