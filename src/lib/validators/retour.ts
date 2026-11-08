import { z } from "zod";
import { idStr, optStr } from "./common";

export const TYPES_RETOUR = ["PIECE_DEPOSEE", "CONSIGNE"] as const;
export const STATUTS_RETOUR = ["EN_ATTENTE", "RENVOYEE_FOURNISSEUR", "REMBOURSEE", "RENDUE_CLIENT", "CLOTUREE"] as const;

/** Retour ou pièce consignée : rattachable à un client et/ou à un ordre de réparation, et éventuellement à une pièce du stock. */
export const retourSchema = z.object({
  type: z.enum(TYPES_RETOUR),
  statut: z.enum(STATUTS_RETOUR).default("EN_ATTENTE"),
  designation: z.string().trim().min(1, "La désignation est requise").max(200),
  reference: optStr(60),
  quantite: z.number().int("Nombre entier requis").min(1, "Quantité invalide").max(10000),
  montantConsigneHT: z.number().min(0, "Montant invalide").max(100000).nullable().optional(),
  fournisseur: optStr(80),
  notes: optStr(1000),
  pieceId: idStr.nullable().optional(),
  clientId: idStr.nullable().optional(),
  ordreId: idStr.nullable().optional(),
  dateEntree: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").optional(),
});

export type RetourInput = z.input<typeof retourSchema>;

export const retourListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(TYPES_RETOUR).optional(),
  statut: z.enum(STATUTS_RETOUR).optional(),
  clientId: idStr.optional(),
  ordreId: idStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const rechercheOrdreQuery = z.object({ q: z.string().trim().max(100).optional(), clientId: idStr.optional() });
