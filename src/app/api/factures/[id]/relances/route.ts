import { idParam, route } from "@/lib/api";
import { marquerRelancee } from "@/lib/services/relances";

/** Enregistre une relance du client pour cette facture impayée. */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "facture"] }, async ({ user, params }) => {
  const { id } = idParam.parse(params);
  return marquerRelancee(id, user.id);
});
