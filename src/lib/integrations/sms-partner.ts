import "server-only";
import type { EnvoiResultat } from "./brevo";

/** Normalise un numéro français vers le format international (33612345678). */
export function normaliserTelephone(brut: string): string | null {
  const n = brut.replace(/[\s().-]/g, "");
  if (/^\+33[1-9]\d{8}$/.test(n)) return n.slice(1);
  if (/^0033[1-9]\d{8}$/.test(n)) return n.slice(2);
  if (/^0[1-9]\d{8}$/.test(n)) return `33${n.slice(1)}`;
  return null;
}

/** SMS via l'API REST SMS Partner. Sans clé : mode simulation. */
export async function envoyerSmsPartner(opts: { to: string; message: string }): Promise<EnvoiResultat> {
  const key = process.env.SMS_PARTNER_API_KEY;
  if (!key) return { ok: false, simulation: true, erreur: "SMS Partner non configuré (mode simulation)" };
  const tel = normaliserTelephone(opts.to);
  if (!tel) return { ok: false, erreur: "Numéro de téléphone invalide" };
  try {
    const res = await fetch("https://api.smspartner.fr/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        apiKey: key,
        phoneNumbers: tel,
        message: opts.message.slice(0, 450),
        sender: process.env.SMS_PARTNER_SENDER ?? "GARAGE",
        gamme: 1,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (!res.ok || json?.success === false) return { ok: false, erreur: `SMS Partner : réponse ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, erreur: "SMS Partner : service injoignable" };
  }
}
