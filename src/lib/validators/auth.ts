import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254),
  password: z.string().min(1, "Mot de passe requis").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
