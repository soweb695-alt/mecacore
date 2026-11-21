import "server-only";
import { db } from "@/lib/db";
import { PARAMETRES_DEFAUT, type ParametresClient } from "@/components/parametres-context";

/** Paramètres partagés avec les formulaires (modes de paiement, délai, seuil, catégories de pièces). */
export async function parametresClient(): Promise<ParametresClient> {
  const [g, categories] = await Promise.all([
    db.parametreGarage.findUnique({ where: { id: 1 }, select: { modesPaiement: true, delaiPaiementDefaut: true, seuilAlerteDefaut: true } }),
    db.categoriePiece.findMany({ orderBy: [{ position: "asc" }, { libelle: "asc" }], select: { libelle: true } }),
  ]);
  return {
    modesPaiement: g?.modesPaiement ?? PARAMETRES_DEFAUT.modesPaiement,
    delaiPaiementDefaut: g?.delaiPaiementDefaut ?? PARAMETRES_DEFAUT.delaiPaiementDefaut,
    seuilAlerteDefaut: g?.seuilAlerteDefaut ?? PARAMETRES_DEFAUT.seuilAlerteDefaut,
    categories: categories.map((c) => c.libelle),
  };
}
