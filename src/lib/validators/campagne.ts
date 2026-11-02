import { z } from "zod";

export const AUDIENCES = { TOUS: "Tous les clients", PARTICULIER: "Particuliers", PRO: "Professionnels" } as const;

export const campagneSchema = z.object({
  nom: z.string().trim().min(2, "Le nom est requis").max(100),
  audience: z.enum(["TOUS", "PARTICULIER", "PRO"]),
  sujet: z.string().trim().min(3, "L'objet de l'e-mail est requis").max(150),
  contenu: z.string().trim().min(10, "Le message est trop court").max(5000, "5 000 caractères maximum"),
});

export type CampagneInput = z.infer<typeof campagneSchema>;
