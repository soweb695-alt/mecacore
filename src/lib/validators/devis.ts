import { z } from "zod";
import { idStr, optStr } from "./common";

export const ligneSchema = z
  .object({
    type: z.enum(["MAIN_OEUVRE", "FORFAIT", "PIECE", "FRAIS_DIVERS"]),
    designation: z.string().trim().min(1, "La désignation est requise").max(200),
    quantite: z.number().positive("La quantité doit être positive").max(10000),
    prixUnitaireHT: z.number().min(0, "Prix invalide").max(100000),
    /** Prix catalogue avant réduction professionnelle (lignes « Pièce » uniquement) : sert à tracer la remise. */
    prixCatalogueHT: z.number().min(0).max(100000).nullable().optional(),
    tvaRate: z.number().min(0).max(30),
    pieceId: idStr.nullable().optional(),
    /** Forfait choisi dans les tarifs : ses pièces sont décrémentées du stock à la validation. */
    tarifId: idStr.nullable().optional(),
  })
  .superRefine((l, ctx) => {
    if (l.pieceId && (l.type !== "PIECE" || !Number.isInteger(l.quantite))) {
      ctx.addIssue({ code: "custom", path: ["quantite"], message: "La quantité d'une pièce doit être un nombre entier" });
    }
  });

export const devisSchema = z
  .object({
    type: z.enum(["MECANIQUE", "PIECE"]),
    clientId: idStr,
    vehiculeId: idStr.nullable().optional(),
    kilometrage: z.number().int("Nombre entier requis").min(0, "Kilométrage invalide").max(3_000_000, "Kilométrage invalide").nullable().optional(),
    prochainCT: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").nullable().optional(),
    dateValidite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").optional(),
    lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne").max(60),
    /** Seuil d'alerte des pièces : alerte dans l'éditeur et bon de commande automatique à la validation. */
    priseEnCompteSeuil: z.boolean().optional(),
    /** Modification : « Enregistrer en brouillon » repasse le devis en BROUILLON (sinon le statut ne change pas). */
    brouillon: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "MECANIQUE" && !d.vehiculeId) {
      ctx.addIssue({ code: "custom", path: ["vehiculeId"], message: "Sélectionnez un véhicule" });
    }
  });

export type DevisInput = z.infer<typeof devisSchema>;
export type LigneInput = z.infer<typeof ligneSchema>;

export const rejetSchema = z.object({ motif: z.string().trim().min(3, "Le motif est obligatoire").max(500) });
const dateHeure = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date et heure invalides");

/** Validation : un devis mécanique exige le technicien et le créneau du rendez-vous (contrôlé dans le service). */
export const validerSchema = z.object({
  mecanicienId: idStr.nullable().optional(),
  rdv: z
    .object({ debut: dateHeure, fin: dateHeure })
    .refine((r) => r.fin > r.debut, { path: ["fin"], message: "La fin doit être après le début" })
    .nullable()
    .optional(),
});

export const devisSearchQuery = z.object({ q: z.string().trim().max(100).optional(), statut: z.enum(["BROUILLON", "ENVOYE", "VALIDE", "REJETE"]).optional() });

export const devisListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  statut: z.enum(["BROUILLON", "ENVOYE", "VALIDE", "REJETE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export { optStr };
