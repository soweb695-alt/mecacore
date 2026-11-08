import { z } from "zod";
import { idStr, optStr } from "./common";

export const pieceSchema = z.object({
  reference: z.string().trim().toUpperCase().min(1, "La référence est requise").max(60),
  nom: z.string().trim().min(1, "La désignation est requise").max(150),
  marque: optStr(60),
  fournisseur: optStr(80),
  categorie: optStr(60),
  prixAchatHT: z.number().min(0, "Prix invalide").max(100000).optional(),
  prixVenteHT: z.number().min(0, "Prix invalide").max(100000),
  /** Peut être négatif : un devis validé malgré un stock insuffisant laisse des pièces dues. */
  stock: z.number().int("Nombre entier requis").min(-100000, "Stock invalide").max(100000),
  seuilAlerte: z.number().int("Nombre entier requis").min(0).max(100000),
  taillePneu: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(/^\d{3}\/\d{2} ?Z?R ?\d{2}$/, "Format attendu : 205/55 R16")])
    .optional(),
  referencesCroisees: z.array(z.string().trim().min(1).max(60)).max(30),
});

export type PieceInput = z.infer<typeof pieceSchema>;

/** Création d'une pièce : le stock initial ne peut pas être négatif. */
export const pieceCreationSchema = pieceSchema.refine((p) => p.stock >= 0, { path: ["stock"], message: "Le stock initial ne peut pas être négatif" });

export const pieceListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  categorie: z.string().trim().max(60).optional(),
  bas: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const tarifSchema = z.object({
  type: z.enum(["MO1", "MO2", "MO3", "FORFAIT", "FRAIS_DIVERS"]),
  libelle: z.string().trim().min(1, "Le libellé est requis").max(120),
  montantHT: z.number().min(0, "Montant invalide").max(100000),
  actif: z.boolean(),
  description: z.string().trim().max(500, "500 caractères maximum").optional(),
  /** Forfait : pièces du stock comprises (décrémentées à la validation du devis qui l'utilise). */
  pieces: z
    .array(z.object({ pieceId: idStr, quantite: z.number().int("Nombre entier requis").min(1, "Quantité invalide").max(100) }))
    .max(20)
    .refine((ps) => new Set(ps.map((p) => p.pieceId)).size === ps.length, "Une pièce ne peut figurer qu'une fois")
    .optional(),
});

export type TarifInput = z.infer<typeof tarifSchema>;
