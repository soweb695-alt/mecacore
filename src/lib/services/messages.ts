import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { envoyerEmailBrevo } from "@/lib/integrations/brevo";
import { envoyerSmsPartner } from "@/lib/integrations/sms-partner";

interface Envoi {
  /** Clé d'idempotence : un même événement n'est envoyé qu'une fois (ex. « rdv:ID:J-1 »). */
  cle: string;
  clientId?: string | null;
  template: string;
  destinataire: string;
  /** true pour un message marketing : exige le consentement RGPD du client. */
  marketing?: boolean;
}

/** Réserve l'envoi : renvoie false si l'événement a déjà été traité (cron exécuté deux fois). */
async function reserver(e: Envoi, canal: "EMAIL" | "SMS", contenu: string): Promise<boolean> {
  try {
    await db.messageLog.create({
      data: { cle: e.cle, clientId: e.clientId ?? null, canal, template: e.template, statut: "EN_COURS", contenu, destinataire: e.destinataire },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Nouvelle tentative autorisée uniquement si l'envoi précédent a échoué.
      const r = await db.messageLog.updateMany({ where: { cle: e.cle, statut: "ECHEC" }, data: { statut: "EN_COURS" } });
      return r.count === 1;
    }
    throw err;
  }
}

async function verifierConsentement(e: Envoi): Promise<boolean> {
  if (!e.marketing) return true;
  if (!e.clientId) return false;
  const c = await db.client.findUnique({ where: { id: e.clientId }, select: { marketingOptIn: true, anonymiseLe: true } });
  return !!c?.marketingOptIn && !c.anonymiseLe;
}

async function finaliser(cle: string, r: { ok: boolean; simulation?: boolean; erreur?: string }) {
  await db.messageLog.update({
    where: { cle },
    data: { statut: r.ok ? "ENVOYE" : r.simulation ? "IGNORE" : "ECHEC", erreur: r.erreur ?? null },
  });
}

export type ResultatEnvoi = "envoye" | "simulation" | "deja" | "refuse" | "echec";

export async function envoyerEmail(e: Envoi & { subject: string; html: string; attachments?: { name: string; content: Buffer }[]; headers?: Record<string, string> }): Promise<ResultatEnvoi> {
  if (!(await verifierConsentement(e))) return "refuse";
  if (!(await reserver(e, "EMAIL", e.subject))) return "deja";
  const r = await envoyerEmailBrevo({ to: e.destinataire, subject: e.subject, html: e.html, attachments: e.attachments, headers: e.headers });
  await finaliser(e.cle, r);
  return r.ok ? "envoye" : r.simulation ? "simulation" : "echec";
}

export async function envoyerSms(e: Envoi & { message: string }): Promise<ResultatEnvoi> {
  if (!(await verifierConsentement(e))) return "refuse";
  if (!(await reserver(e, "SMS", e.message))) return "deja";
  const r = await envoyerSmsPartner({ to: e.destinataire, message: e.message });
  await finaliser(e.cle, r);
  return r.ok ? "envoye" : r.simulation ? "simulation" : "echec";
}
