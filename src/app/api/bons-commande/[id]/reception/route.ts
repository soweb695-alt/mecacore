import { idParam, route } from "@/lib/api";
import { receptionnerBonCommande } from "@/lib/services/bl";
import { receptionSchema } from "@/lib/validators/bl";

export const POST = route<ReturnType<typeof receptionSchema.parse>, undefined, { id: string }>(
  { permission: ["update", "bonCommande"], body: receptionSchema },
  async ({ body, params }) => receptionnerBonCommande(idParam.parse(params).id, body.lignes),
);
