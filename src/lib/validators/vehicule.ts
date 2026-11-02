import { z } from "zod";
import { idStr, optStr } from "./common";

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

const dateJour = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]);

export const vehiculeSchema = z.object({
  /** Le véhicule existe d'abord : le client lui est associé (facultatif, modifiable). */
  clientId: idStr.nullable().optional(),
  vin: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(VIN_REGEX, "VIN invalide (17 caractères, sans I, O ni Q)")])
    .optional(),
  immatriculation: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9 -]{3,11}$/, "Immatriculation invalide"),
  marque: z.string().trim().min(1, "La marque est requise").max(60),
  modele: z.string().trim().min(1, "Le modèle est requis").max(80),
  annee: z.number().int().min(1950, "Année invalide").max(new Date().getFullYear() + 1, "Année invalide").nullable(),
  motorisation: optStr(80),
  kilometrage: z.number().int("Nombre entier requis").min(0, "Kilométrage invalide").max(3_000_000, "Kilométrage invalide").nullable().optional(),
  prochainCT: dateJour.nullable().optional(),
});

export type VehiculeInput = z.infer<typeof vehiculeSchema>;

export const vinQuery = z.object({
  vin: z.string().trim().toUpperCase().regex(VIN_REGEX, "VIN invalide"),
});
