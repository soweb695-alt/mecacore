import "server-only";

export interface EnvoiResultat {
  ok: boolean;
  simulation?: boolean;
  erreur?: string;
}

/** E-mail transactionnel via l'API REST Brevo. Sans clé : mode simulation (rien n'est envoyé). */
export async function envoyerEmailBrevo(opts: { to: string; subject: string; html: string; attachments?: { name: string; content: Buffer }[]; headers?: Record<string, string> }): Promise<EnvoiResultat> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, simulation: true, erreur: "Brevo non configuré (mode simulation)" };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: "Garage" },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        ...(opts.headers ? { headers: opts.headers } : {}),
        ...(opts.attachments?.length ? { attachment: opts.attachments.map((a) => ({ name: a.name, content: a.content.toString("base64") })) } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, erreur: `Brevo : réponse ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, erreur: "Brevo : service injoignable" };
  }
}
