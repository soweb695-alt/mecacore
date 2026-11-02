import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { nomClient } from "@/lib/format";
import { emailDevis } from "@/lib/messages/templates";
import { pdfDevis } from "@/lib/pdf/devis";
import { envoyerEmail } from "@/lib/services/messages";

/**
 * Envoie le devis par e-mail (PDF en pièce jointe). Le devis ne passe de « Brouillon » à « Envoyé »
 * que si l'e-mail est réellement parti : sans clé Brevo (simulation) ou en cas d'échec, il reste « Brouillon ».
 * Sauvegarder ou imprimer ne change jamais le statut.
 */
export async function envoyerDevisParEmail(id: string) {
  const devis = await db.devis.findUnique({ where: { id }, include: { client: true } });
  if (!devis) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
  if (devis.statut === "VALIDE" || devis.statut === "REJETE") throw new ApiError(409, "Ce devis est déjà traité", "STATUT_INVALIDE");
  const email = devis.client.email;
  if (!email) throw new ApiError(400, "Ce client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche.", "EMAIL_MANQUANT");

  const doc = await pdfDevis(id);
  if (!doc) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
  const params = await db.parametreGarage.findUnique({ where: { id: 1 } });
  const mail = emailDevis({ garage: params?.nomGarage ?? "Garage", numero: devis.numero, client: nomClient(devis.client), telephone: params?.telephone ?? "" });
  // Un envoi = une clé : renvoyer le devis est possible, mais jamais deux fois à la suite par accident.
  const n = (await db.messageLog.count({ where: { cle: { startsWith: `devis:${id}:` } } })) + 1;
  const res = await envoyerEmail({
    cle: `devis:${id}:${n}`,
    clientId: devis.clientId,
    template: "devis",
    destinataire: email,
    subject: mail.subject,
    html: mail.html,
    attachments: [{ name: `${devis.numero}.pdf`, content: Buffer.from(doc.pdf) }],
  });
  if (res === "simulation") {
    throw new ApiError(503, "L'envoi d'e-mails n'est pas configuré (clé Brevo manquante). Le devis reste en brouillon.", "EMAIL_NON_CONFIGURE");
  }
  if (res !== "envoye") throw new ApiError(502, "L'e-mail n'a pas pu être envoyé. Le devis reste en brouillon.", "EMAIL_ECHEC");
  await db.devis.updateMany({ where: { id, statut: "BROUILLON" }, data: { statut: "ENVOYE" } });
  return { id, destinataire: email };
}
