import { route } from "@/lib/api";
import { enregistrerTarif, tarifsActifs } from "@/lib/services/tarifs";
import { tarifSchema } from "@/lib/validators/piece";

export const GET = route({ permission: ["read", "tarif"] }, async () => tarifsActifs());

export const POST = route({ permission: ["create", "tarif"], body: tarifSchema }, async ({ body }) => enregistrerTarif(body));
