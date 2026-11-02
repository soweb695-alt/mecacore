import { idParam, route } from "@/lib/api";
import { accesOrdre, demarrerTravaux } from "@/lib/services/ordres";

export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "ordre"] }, async ({ user, params }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id); // le mécanicien n'agit que sur ses propres OR
  return demarrerTravaux(id);
});
