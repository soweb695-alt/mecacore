import { idParam, route } from "@/lib/api";
import { envoyerVehiculePret } from "@/lib/services/emails-client";

/** E-mail « Véhicule prêt » au client de l'OR (depuis l'OR ou le devis associé). */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["create", "message"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  return envoyerVehiculePret(id);
});
