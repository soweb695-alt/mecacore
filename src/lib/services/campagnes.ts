import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { rendreCampagneHtml } from "@/lib/campagne-contenu";
import { lienDesinscription } from "@/lib/desinscription";
import { envoyerEmail } from "@/lib/services/messages";
import type { Prisma } from "@/generated/prisma/client";

export const MAX_DESTINATAIRES = 500;
const SIMULTANES = 5;

type Audience = "TOUS" | "PARTICULIER" | "PRO";

/** Destinataires : clients actifs, non anonymisés, avec e-mail ET consentement marketing (RGPD). */
function critereDestinataires(audience: Audience): Prisma.ClientWhereInput {
  return { isActive: true, anonymiseLe: null, marketingOptIn: true, email: { not: null }, ...(audience === "TOUS" ? {} : { type: audience }) };
}

export async function compterDestinataires(): Promise<Record<Audience, number>> {
  const [tous, particulier, pro] = await Promise.all([
    db.client.count({ where: critereDestinataires("TOUS") }),
    db.client.count({ where: critereDestinataires("PARTICULIER") }),
    db.client.count({ where: critereDestinataires("PRO") }),
  ]);
  return { TOUS: tous, PARTICULIER: particulier, PRO: pro };
}

export async function creerCampagne(input: { nom: string; audience: Audience; sujet: string; contenu: string }) {
  const c = await db.campagne.create({ data: { nom: input.nom, type: "MANUELLE", template: "campagne", canal: "EMAIL", audience: input.audience, sujet: input.sujet, contenu: input.contenu }, select: { id: true } });
  return c;
}

async function campagneModifiable(id: string) {
  const c = await db.campagne.findUnique({ where: { id } });
  if (!c || c.type !== "MANUELLE") throw new ApiError(404, "Campagne introuvable", "INTROUVABLE");
  if (c.envoyeeLe) throw new ApiError(409, "Cette campagne a déjà été envoyée", "DEJA_ENVOYEE");
  return c;
}

export async function modifierCampagne(id: string, input: { nom: string; audience: Audience; sujet: string; contenu: string }) {
  await campagneModifiable(id);
  await db.campagne.update({ where: { id }, data: { nom: input.nom, audience: input.audience, sujet: input.sujet, contenu: input.contenu } });
  return { id };
}

export async function supprimerCampagne(id: string) {
  await campagneModifiable(id);
  await db.campagne.delete({ where: { id } });
  return { id };
}

/**
 * Envoie la campagne aux clients ayant donné leur accord. Idempotent : une clé par client (« campagne:ID:CLIENT »)
 * empêche tout double envoi ; une campagne partiellement échouée peut être relancée et ne réessaie que les échecs.
 * Chaque envoi est tracé dans l'historique du client (MessageLog) et contient un lien de désinscription signé.
 */
export async function envoyerCampagne(id: string) {
  const c = await db.campagne.findUnique({ where: { id } });
  if (!c || c.type !== "MANUELLE" || !c.sujet || !c.contenu) throw new ApiError(404, "Campagne introuvable", "INTROUVABLE");
  if (c.envoyeeLe && c.nbEchecs === 0) throw new ApiError(409, "Cette campagne a déjà été envoyée", "DEJA_ENVOYEE");
  if (!process.env.BREVO_API_KEY) throw new ApiError(503, "L'envoi d'e-mails n'est pas configuré (clé Brevo manquante).", "EMAIL_NON_CONFIGURE");

  const destinataires = await db.client.findMany({
    where: critereDestinataires(c.audience as Audience),
    select: { id: true, firstName: true, lastName: true, companyName: true, type: true, email: true },
    orderBy: { id: "asc" },
    take: MAX_DESTINATAIRES + 1,
  });
  if (destinataires.length === 0) throw new ApiError(400, "Aucun client n'a accepté de recevoir des offres pour cette audience.", "AUCUN_DESTINATAIRE");
  if (destinataires.length > MAX_DESTINATAIRES) throw new ApiError(400, `Trop de destinataires (${MAX_DESTINATAIRES} maximum par campagne).`, "TROP_DE_DESTINATAIRES");

  // Verrou : un seul envoi à la fois (la date d'envoi sert de marqueur).
  const claim = c.envoyeeLe
    ? { count: 1 }
    : await db.campagne.updateMany({ where: { id, envoyeeLe: null }, data: { envoyeeLe: new Date() } });
  if (claim.count === 0) throw new ApiError(409, "Cette campagne est déjà en cours d'envoi", "DEJA_ENVOYEE");

  const params = await db.parametreGarage.findUnique({ where: { id: 1 } });
  const garage = params?.nomGarage ?? "Garage";
  let envoyes = 0;
  let echecs = 0;
  let dejaEnvoyes = 0;

  for (let i = 0; i < destinataires.length; i += SIMULTANES) {
    await Promise.all(
      destinataires.slice(i, i + SIMULTANES).map(async (d) => {
        const lien = lienDesinscription(d.id);
        const res = await envoyerEmail({
          cle: `campagne:${id}:${d.id}`,
          clientId: d.id,
          template: "campagne",
          destinataire: d.email!,
          marketing: true,
          subject: c.sujet!,
          html: rendreCampagneHtml(c.contenu!, { prenom: d.firstName ?? "", nom: d.type === "PRO" && d.companyName ? d.companyName : (d.lastName ?? ""), garage }, lien, params?.adresse ?? ""),
          headers: { "List-Unsubscribe": `<${lien}>` },
        }).catch(() => "echec" as const);
        if (res === "envoye") envoyes++;
        else if (res === "deja") dejaEnvoyes++;
        else echecs++;
      }),
    );
  }
  const total = envoyes + dejaEnvoyes;
  await db.campagne.update({ where: { id }, data: { nbDestinataires: destinataires.length, nbEnvoyes: total, nbEchecs: echecs } });
  return { id, destinataires: destinataires.length, envoyes: total, echecs };
}
