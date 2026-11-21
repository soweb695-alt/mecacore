import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { manquesBrevo, verifierCompteBrevo } from "@/lib/integrations/brevo";
import { envoyerEmail } from "@/lib/services/messages";

/** État de la connexion Brevo (administrateur) : configuration présente et clé API acceptée par Brevo. */
export const GET = route({ permission: ["update", "parametre"] }, async () => {
  const p = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { expediteurEmail: true } });
  const manques = manquesBrevo(p?.expediteurEmail);
  const compte = manques.includes("BREVO_API_KEY") ? null : await verifierCompteBrevo();
  return { manques, expediteur: p?.expediteurEmail?.trim() || process.env.BREVO_SENDER_EMAIL?.trim() || null, compte };
});

const testSchema = z.object({ destinataire: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(120) });

/** E-mail de test réel (administrateur), tracé dans l'historique des messages. */
export const POST = route({ permission: ["update", "parametre"], body: testSchema }, async ({ body }) => {
  const g = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { nomGarage: true } });
  const n = (await db.messageLog.count({ where: { cle: { startsWith: "test_email:" } } })) + 1;
  const res = await envoyerEmail({
    cle: `test_email:${n}`,
    template: "test_email",
    destinataire: body.destinataire,
    subject: `Test d'envoi · ${g?.nomGarage ?? "Garage"}`,
    html: `<p>Cet e-mail confirme que ${g?.nomGarage ?? "le garage"} peut envoyer des e-mails (devis, véhicule prêt, rappels) via Brevo.</p><p>Répondez à ce message pour vérifier que les réponses arrivent bien sur l'adresse du garage.</p>`,
  });
  if (res === "envoye") return { ok: true };
  const log = await db.messageLog.findUnique({ where: { cle: `test_email:${n}` }, select: { erreur: true } });
  if (res === "simulation") throw new ApiError(503, `Envoi impossible : ${log?.erreur ?? "Brevo non configuré"}`, "EMAIL_NON_CONFIGURE");
  throw new ApiError(502, log?.erreur ?? "L'e-mail n'a pas pu être envoyé", "EMAIL_ECHEC");
});
