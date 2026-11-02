import { z } from "zod";
import { COULEUR_REGEX } from "@/lib/colors";

// bcrypt ne lit que les 72 premiers octets : on les impose comme maximum.
const motDePasse = z
  .string()
  .min(12, "12 caractères minimum")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "72 octets maximum");

const base = {
  firstName: z.string().trim().min(1, "Le prénom est requis").max(60),
  lastName: z.string().trim().min(1, "Le nom est requis").max(60),
  role: z.enum(["ADMIN", "SECRETARIAT", "MECANICIEN"]),
  /** Couleur attitrée #RRGGBB ; vide ou absente = couleur automatique. */
  couleur: z.union([z.literal(""), z.string().regex(COULEUR_REGEX, "Couleur invalide")]).nullable().optional(),
};

export const collaborateurCreation = z.object({
  ...base,
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254),
  password: motDePasse,
});

export const collaborateurEdition = z.object({
  ...base,
  isActive: z.boolean(),
  password: z.union([z.literal(""), motDePasse]).optional(),
});

export type CollaborateurCreation = z.infer<typeof collaborateurCreation>;
export type CollaborateurEdition = z.infer<typeof collaborateurEdition>;
