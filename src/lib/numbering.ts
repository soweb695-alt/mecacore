import "server-only";
import type { Tx } from "@/lib/db";

export type TypeCompteur = "DEVIS" | "FACTURE" | "ORDRE" | "BC" | "BL" | "RET";

/** Préfixes paramétrables (onglet Paramètres). Les retours & consignées utilisent le préfixe fixe « RET ». */
const PREFIXES: Partial<Record<TypeCompteur, "prefixDevis" | "prefixFacture" | "prefixOrdre" | "prefixBonCommande" | "prefixBonLivraison">> = {
  DEVIS: "prefixDevis",
  FACTURE: "prefixFacture",
  ORDRE: "prefixOrdre",
  BC: "prefixBonCommande",
  BL: "prefixBonLivraison",
};

/** Numéro séquentiel {PREFIXE}-{ANNEE}-{COMPTEUR_4}, incrémenté atomiquement dans la transaction. */
export async function prochainNumero(tx: Tx, type: TypeCompteur, date = new Date()): Promise<string> {
  const annee = Number(new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "Europe/Paris" }).format(date));
  const champ = PREFIXES[type];
  const params = champ ? await tx.parametreGarage.findUnique({ where: { id: 1 } }) : null;
  const prefixe = (champ && params?.[champ]) || type;
  // Upsert + increment : verrouillage de ligne géré par PostgreSQL.
  const compteur = await tx.compteur.upsert({
    where: { type_annee: { type, annee } },
    create: { type, annee, valeur: 1 },
    update: { valeur: { increment: 1 } },
  });
  return `${prefixe}-${annee}-${String(compteur.valeur).padStart(4, "0")}`;
}
