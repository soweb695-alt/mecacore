import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { clientListQuery, clientSchema } from "@/lib/validators/client";
import { nomClient } from "@/lib/format";
import { nn } from "@/lib/validators/common";
import { clientData, rechercherClients } from "@/lib/services/clients";

export const GET = route({ permission: ["read", "client"], query: clientListQuery }, async ({ query }) => {
  return rechercherClients(query);
});

export const POST = route({ permission: ["create", "client"], body: clientSchema }, async ({ body }) => {
  const client = await db.client.create({ data: clientData(body) });
  return { id: client.id, type: client.type, nom: nomClient(client), email: nn(client.email), discountRate: Number(client.discountRate) };
});
