import { db } from "@/lib/db";
import { ApiError, idParam, route } from "@/lib/api";

/** Droit à l'oubli : efface les données personnelles, conserve les factures (obligation légale de 10 ans). */
export const DELETE = route<undefined, undefined, { id: string }>(
  { permission: ["delete", "client"] },
  async ({ params }) => {
    const { id } = idParam.parse(params);
    const client = await db.client.findUnique({ where: { id } });
    if (!client) throw new ApiError(404, "Client introuvable", "INTROUVABLE");
    if (client.anonymiseLe) return { id };
    await db.$transaction([
      db.client.update({
        where: { id },
        data: {
          firstName: "Anonyme",
          lastName: `Client ${id.slice(-6)}`,
          companyName: client.type === "PRO" ? "Société anonymisée" : null,
          siret: null,
          tvaNumber: null,
          email: null,
          phone: null,
          address: null,
          marketingOptIn: false,
          isActive: false,
          anonymiseLe: new Date(),
        },
      }),
      db.messageLog.updateMany({ where: { clientId: id }, data: { contenu: null, destinataire: null } }),
    ]);
    return { id };
  },
);
