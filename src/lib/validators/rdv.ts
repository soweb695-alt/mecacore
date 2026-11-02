import { z } from "zod";
import { idStr, optStr } from "./common";

const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date et heure invalides");

export const rdvSchema = z
  .object({
    clientId: idStr,
    vehiculeId: idStr,
    userId: idStr,
    devisId: idStr.nullable().optional(),
    debut: local,
    fin: local,
    motif: optStr(200),
  })
  .refine((v) => v.fin > v.debut, { path: ["fin"], message: "La fin doit être après le début" });

export const rdvStatutSchema = z.object({ statut: z.enum(["PLANIFIE", "CONFIRME", "HONORE", "ANNULE", "NO_SHOW"]) });

export const rdvQuery = z.object({
  du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  au: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
