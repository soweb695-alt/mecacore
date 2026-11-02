import "server-only";
import { db } from "@/lib/db";

const anneesAvant = (n: number, now: Date) => new Date(Date.UTC(now.getUTCFullYear() - n, now.getUTCMonth(), now.getUTCDate()));

/**
 * Politique de conservation (RGPD), durées configurables dans les paramètres du garage :
 *  - messages : supprimés après 3 ans par défaut ;
 *  - clients inactifs (aucun devis, facture ni rendez-vous récent) : anonymisés après 5 ans par défaut ;
 *  - factures : conservées 10 ans (jamais supprimées ici, obligation légale).
 */
export async function appliquerRetention(now = new Date()) {
  const p = await db.parametreGarage.findUnique({ where: { id: 1 } });
  const limiteMessages = anneesAvant(p?.retentionMessagesAns ?? 3, now);
  const limiteClients = anneesAvant(p?.retentionClientsAns ?? 5, now);

  const messages = await db.messageLog.deleteMany({ where: { envoyeLe: { lt: limiteMessages } } });

  const inactifs = await db.client.findMany({
    where: {
      anonymiseLe: null,
      createdAt: { lt: limiteClients },
      devis: { none: { dateCreation: { gte: limiteClients } } },
      factures: { none: { dateEmission: { gte: limiteClients } } },
      rendezVous: { none: { debut: { gte: limiteClients } } },
    },
    select: { id: true, type: true },
  });
  for (const c of inactifs) {
    await db.client.update({
      where: { id: c.id },
      data: {
        firstName: "Anonyme", lastName: `Client ${c.id.slice(-6)}`, companyName: c.type === "PRO" ? "Société anonymisée" : null,
        siret: null, tvaNumber: null, email: null, phone: null, address: null, marketingOptIn: false, isActive: false, anonymiseLe: now,
      },
    });
  }
  return { messagesSupprimes: messages.count, clientsAnonymises: inactifs.length };
}
