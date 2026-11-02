import { route } from "@/lib/api";
import { creerCampagne } from "@/lib/services/campagnes";
import { campagneSchema } from "@/lib/validators/campagne";

export const POST = route({ permission: ["create", "campagne"], body: campagneSchema }, async ({ body }) => creerCampagne(body));
