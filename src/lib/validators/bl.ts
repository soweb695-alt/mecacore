import { z } from "zod";
import { idStr } from "./common";

const ligne = z.object({ pieceId: idStr, quantite: z.number().int("Nombre entier requis").min(1).max(10000) });

export const bonCommandeSchema = z.object({
  fournisseur: z.string().trim().min(1, "Le fournisseur est requis").max(100),
  lignes: z.array(ligne).min(1, "Ajoutez au moins une pièce").max(100),
});

export const receptionSchema = z.object({
  lignes: z.array(z.object({ ligneId: idStr, quantite: z.number().int().min(0).max(10000) })).min(1).max(100),
});

export const bonLivraisonSchema = z.object({
  clientId: idStr,
  bonCommandeId: idStr.nullable().optional(),
  lignes: z.array(ligne).min(1, "Ajoutez au moins une pièce").max(100),
});

export const bonCommandeEditionSchema = z.object({
  fournisseur: z.string().trim().min(1, "Le fournisseur est requis").max(100),
  lignes: z.array(ligne).min(1, "Ajoutez au moins une pièce").max(100),
});
