import { idParam, route } from "@/lib/api";
import { envoyerRappelRdv } from "@/lib/services/emails-client";

/** E-mail de rappel du rendez-vous, envoyé à la main depuis sa fiche. */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["create", "message"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  return envoyerRappelRdv(id);
});
