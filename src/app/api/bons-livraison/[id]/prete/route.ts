import { idParam, route } from "@/lib/api";
import { marquerPrete } from "@/lib/services/bl";

export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "bonLivraison"] }, async ({ params }) => marquerPrete(idParam.parse(params).id));
