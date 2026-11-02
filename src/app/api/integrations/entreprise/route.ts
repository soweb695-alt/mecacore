import { z } from "zod";
import { route } from "@/lib/api";
import { rechercherEntreprises } from "@/lib/integrations/entreprise";

/** Pré-remplissage d'un client professionnel (raison sociale, SIRET, adresse, n° de TVA). */
export const GET = route({ permission: ["create", "client"], query: z.object({ q: z.string().trim().min(3).max(100) }) }, async ({ query }) =>
  rechercherEntreprises(query.q),
);
