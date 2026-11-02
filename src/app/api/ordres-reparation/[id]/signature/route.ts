import { z } from "zod";
import { idParam, route } from "@/lib/api";
import { accesOrdre, enregistrerSignature } from "@/lib/services/ordres";

const body = z.object({ image: z.string().max(600_000) });

export const POST = route<z.infer<typeof body>, undefined, { id: string }>({ permission: ["update", "ordre"], body }, async ({ user, body, params }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id);
  return enregistrerSignature(id, body.image);
});
