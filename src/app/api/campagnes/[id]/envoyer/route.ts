import { idParam, route } from "@/lib/api";
import { envoyerCampagne } from "@/lib/services/campagnes";

export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "campagne"] }, async ({ params }) =>
  envoyerCampagne(idParam.parse(params).id),
);
