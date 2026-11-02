import "server-only";
import type { Tx } from "@/lib/db";
import { prochainNumero } from "@/lib/numbering";

/** Quantité à recommander : on remonte le stock à 2 × le seuil d'alerte (au moins 1). */
export function quantiteAReapprovisionner(stock: number, seuilAlerte: number): number {
  return Math.max(1, 2 * seuilAlerte - stock);
}

/**
 * Crée automatiquement un bon de commande « en attente » pour les pièces tombées au seuil d'alerte.
 * - une pièce déjà présente dans un bon de commande non reçu n'est jamais recommandée deux fois ;
 * - les pièces d'un même fournisseur sont regroupées sur un seul bon ;
 * - le bon est modifiable avant réception (fournisseur à compléter si la fiche pièce n'en a pas).
 */
export async function verifierReapprovisionnement(tx: Tx, pieceIds: string[]) {
  if (pieceIds.length === 0) return [];
  const pieces = await tx.piece.findMany({
    where: { id: { in: [...new Set(pieceIds)] }, isActive: true, seuilAlerte: { gt: 0 } },
    select: { id: true, fournisseur: true, stock: true, seuilAlerte: true },
    orderBy: { id: "asc" },
  });
  const groupes = new Map<string, { pieceId: string; quantite: number }[]>();
  for (const p of pieces) {
    if (p.stock > p.seuilAlerte) continue;
    const dejaCommandee = await tx.ligneBonCommande.findFirst({
      where: { pieceId: p.id, bonCommande: { statut: { in: ["EN_ATTENTE", "RECEPTIONNEE_PARTIELLE"] } } },
      select: { id: true },
    });
    if (dejaCommandee) continue;
    const fournisseur = p.fournisseur?.trim() || "À définir";
    const lignes = groupes.get(fournisseur) ?? [];
    lignes.push({ pieceId: p.id, quantite: quantiteAReapprovisionner(p.stock, p.seuilAlerte) });
    groupes.set(fournisseur, lignes);
  }
  const crees: { id: string; numero: string; fournisseur: string }[] = [];
  for (const [fournisseur, lignes] of groupes) {
    const numero = await prochainNumero(tx, "BC");
    const bc = await tx.bonCommande.create({ data: { numero, fournisseur, automatique: true, lignes: { create: lignes } }, select: { id: true } });
    crees.push({ id: bc.id, numero, fournisseur });
  }
  return crees;
}
