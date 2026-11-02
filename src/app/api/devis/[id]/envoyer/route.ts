import { idParam, route } from "@/lib/api";
import { envoyerDevisParEmail } from "@/lib/services/devis-email";

export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "devis"] }, async ({ params }) =>
  envoyerDevisParEmail(idParam.parse(params).id),
);
