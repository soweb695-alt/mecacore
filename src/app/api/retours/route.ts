import { route } from "@/lib/api";
import { creerRetour } from "@/lib/services/retours";
import { retourSchema } from "@/lib/validators/retour";

export const POST = route({ permission: ["create", "retour"], body: retourSchema }, async ({ body, user }) => creerRetour(user.id, body));
