import { z } from "zod";
import { ligneSchema } from "./devis";
import { idStr } from "./common";

export const factureDepuisDevisSchema = z.object({ devisId: idStr });

export const paiementSchema = z
  .object({
    montant: z.number().positive("Le montant doit être positif").max(1_000_000),
    mode: z.enum(["CB", "ESPECES", "CHEQUE", "VIREMENT", "PLUSIEURS_FOIS"]),
    nombreFois: z.number().int().min(2, "Au moins 2 fois").max(12, "12 fois maximum").nullable().optional(),
    reference: z.string().trim().max(80).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.mode === "PLUSIEURS_FOIS" && !p.nombreFois) {
      ctx.addIssue({ code: "custom", path: ["nombreFois"], message: "Choisissez en combien de fois" });
    }
  });

export const factureListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  statut: z.enum(["BROUILLON", "EMISE", "PARTIELLEMENT_PAYEE", "PAYEE", "IMPAYEE", "ANNULEE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const remiseGlobaleSchema = z
  .object({
    type: z.enum(["EUROS", "POURCENT"]),
    base: z.enum(["HT", "TTC"]),
    valeur: z.number().min(0, "Remise invalide").max(1_000_000),
  })
  .superRefine((r, ctx) => {
    if (r.type === "POURCENT" && r.valeur >= 100) ctx.addIssue({ code: "custom", path: ["valeur"], message: "Le pourcentage doit être inférieur à 100" });
  });

export const modePaiementSchema = z.enum(["CB", "ESPECES", "CHEQUE", "VIREMENT", "PLUSIEURS_FOIS"]);

/** Options communes à toute création de facture : remise globale et mode de règlement prévu. */
export const optionsFactureSchema = z.object({
  remise: remiseGlobaleSchema.nullable().optional(),
  modePaiement: modePaiementSchema.nullable().optional(),
});

export const factureDepuisDevisAvecOptionsSchema = factureDepuisDevisSchema.extend(optionsFactureSchema.shape);

export const factureManuelleSchema = z
  .object({
    clientId: idStr,
    dateEcheance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").optional(),
    lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne").max(60),
  })
  .extend(optionsFactureSchema.shape);

export const factureModeSchema = z.object({ modePaiement: modePaiementSchema.nullable() });

/** Brouillon issu d'un OR : lignes modifiables (une ligne existante garde ses pièces de forfait via son id). */
export const brouillonSchema = z
  .object({
    dateEcheance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").optional(),
    lignes: z.array(z.intersection(ligneSchema, z.object({ id: idStr.optional() }))).min(1, "Ajoutez au moins une ligne").max(60),
  })
  .extend(optionsFactureSchema.shape);

export const exportFacturesSchema = z.object({ ids: z.array(idStr).min(1, "Sélectionnez au moins une facture").max(500) });
