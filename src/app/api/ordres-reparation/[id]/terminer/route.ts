import { z } from "zod";
import { idParam, route } from "@/lib/api";
import { accesOrdre, terminerOrdre } from "@/lib/services/ordres";

const body = z.object({ kilometrage: z.number().int("Nombre entier requis").min(0, "Kilométrage invalide").max(3_000_000, "Kilométrage invalide") });

export const POST = route<z.infer<typeof body>, undefined, { id: string }>({ permission: ["update", "ordre"], body }, async ({ user, body, params }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id);
  return terminerOrdre(id, body.kilometrage);
});
