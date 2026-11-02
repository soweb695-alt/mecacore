import { z } from "zod";
import { optEmail, optPhone, optStr } from "./common";

export const clientSchema = z
  .object({
    type: z.enum(["PARTICULIER", "PRO"]),
    firstName: optStr(80),
    lastName: optStr(80),
    companyName: optStr(120),
    siret: z
      .union([z.literal(""), z.string().trim().regex(/^\d{3}\s?\d{3}\s?\d{3}\s?\d{5}$/, "SIRET invalide (14 chiffres)")])
      .optional(),
    tvaNumber: optStr(20),
    email: optEmail,
    phone: optPhone,
    address: optStr(250),
    paymentTerms: z.number().int("Nombre entier requis").min(0).max(365),
    creditLimit: z.number().min(0).max(1_000_000),
    discountRate: z.number().min(0, "Entre 0 et 100").max(100, "Entre 0 et 100"),
    marketingOptIn: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PRO" && !v.companyName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "La raison sociale est requise pour un professionnel" });
    }
    if (v.type === "PARTICULIER" && !v.lastName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["lastName"], message: "Le nom est requis" });
    }
  });

export type ClientInput = z.infer<typeof clientSchema>;

export const clientListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(["PARTICULIER", "PRO"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
