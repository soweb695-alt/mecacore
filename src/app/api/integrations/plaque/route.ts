import { z } from "zod";
import { route } from "@/lib/api";
import { decoderPlaque, plaqueConfiguree } from "@/lib/integrations/vin";

const query = z.object({
  plaque: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9 -]{3,11}$/, "Immatriculation invalide"),
});

/** Renvoie { info, configure } : `info` est null si le service n'est pas branché ou ne trouve rien (saisie manuelle). */
export const GET = route({ permission: ["read", "vehicule"], query }, async ({ query: q }) => ({
  configure: plaqueConfiguree(),
  info: await decoderPlaque(q.plaque.replace(/\s/g, "-")),
}));
