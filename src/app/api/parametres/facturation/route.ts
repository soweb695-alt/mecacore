import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { facturationSchema, MENTIONS_FACTURE_DEFAUT } from "@/lib/validators/parametres";

/**
 * Paramètres › Facturation (administrateur) : modes de paiement proposés, délai de paiement des nouveaux clients,
 * préfixes de numérotation (appliqués aux prochains numéros), mentions des factures et affichage des remises sur les PDF.
 */
export const PUT = route({ permission: ["update", "parametre"], body: facturationSchema }, async ({ body }) => {
  const mentions = body.mentionsFacture.trim();
  await db.parametreGarage.update({
    where: { id: 1 },
    data: {
      modesPaiement: body.modesPaiement,
      delaiPaiementDefaut: body.delaiPaiementDefaut,
      prefixDevis: body.prefixDevis,
      prefixFacture: body.prefixFacture,
      prefixBonLivraison: body.prefixBonLivraison,
      // Texte identique au texte par défaut : on ne le fige pas (il pourra évoluer avec l'application).
      mentionsFacture: mentions === "" || mentions === MENTIONS_FACTURE_DEFAUT ? null : mentions,
      affichageRemise: body.affichageRemise,
    },
  });
  return { ok: true };
});
