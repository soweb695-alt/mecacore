import { z } from "zod";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { rechercherVehicules, vehiculeData } from "@/lib/services/vehicules";
import { vehiculeSchema } from "@/lib/validators/vehicule";

export const GET = route(
  { permission: ["read", "vehicule"], query: z.object({ clientId: z.string().max(40).optional(), q: z.string().trim().max(60).optional() }) },
  async ({ query }) => rechercherVehicules({ q: query.q, clientId: query.clientId, take: 30 }),
);

export const POST = route({ permission: ["create", "vehicule"], body: vehiculeSchema }, async ({ body }) => {
  const v = await db.vehicule.create({ data: vehiculeData(body), select: { id: true } });
  return { id: v.id };
});
