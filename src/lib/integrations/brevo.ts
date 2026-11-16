import "server-only";

export interface EnvoiResultat {
  ok: boolean;
  simulation?: boolean;
  erreur?: string;
}

const API = "https://api.brevo.com/v3";

/** Configuration lue dans l'environnement : clé API et adresse d'expédition (vérifiée dans Brevo). */
export function configBrevo(): { cle: string; expediteur: string } | null {
  const cle = process.env.BREVO_API_KEY?.trim();
  const expediteur = process.env.BREVO_SENDER_EMAIL?.trim();
  return cle && expediteur ? { cle, expediteur } : null;
}

/** Ce qui manque pour envoyer (affiché dans « Mon Garage ») ; tableau vide si tout est configuré. */
export function manquesBrevo(): string[] {
  return [!process.env.BREVO_API_KEY?.trim() && "BREVO_API_KEY", !process.env.BREVO_SENDER_EMAIL?.trim() && "BREVO_SENDER_EMAIL"].filter((x): x is string => !!x);
}

/** Message d'erreur de Brevo (« Key not found », « sender not valid »…) : utile au diagnostic, sans donnée sensible. */
async function erreurBrevo(res: Response): Promise<string> {
  let detail = "";
  try {
    const corps = (await res.json()) as { message?: unknown; code?: unknown };
    if (typeof corps?.message === "string") detail = corps.message.slice(0, 200);
  } catch {
    /* corps vide ou non JSON */
  }
  const sens: Record<number, string> = { 400: "requête refusée", 401: "clé API invalide", 403: "accès refusé (compte ou IP non autorisés)", 429: "trop d'envois, réessayez plus tard" };
  return `Brevo : réponse ${res.status}${sens[res.status] ? ` (${sens[res.status]})` : ""}${detail ? ` : ${detail}` : ""}`;
}

/**
 * E-mail transactionnel via l'API REST Brevo. Sans clé ou sans adresse d'expédition : mode simulation (rien n'est envoyé).
 * Expéditeur : adresse BREVO_SENDER_EMAIL avec le nom du garage ; les réponses du client vont à `repondreA` (e-mail du garage).
 */
export async function envoyerEmailBrevo(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { name: string; content: Buffer }[];
  headers?: Record<string, string>;
  /** Nom affiché de l'expéditeur (nom du garage). */
  nomExpediteur?: string;
  /** Adresse de réponse (e-mail du garage). */
  repondreA?: string;
  /** Étiquette Brevo (statistiques par type d'e-mail). */
  tag?: string;
}): Promise<EnvoiResultat> {
  const config = configBrevo();
  if (!config) return { ok: false, simulation: true, erreur: `Brevo non configuré (manque ${manquesBrevo().join(" et ")}) : mode simulation` };
  try {
    const res = await fetch(`${API}/smtp/email`, {
      method: "POST",
      headers: { "api-key": config.cle, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: config.expediteur, name: (opts.nomExpediteur?.trim() || "Garage").slice(0, 70) },
        to: [{ email: opts.to }],
        ...(opts.repondreA ? { replyTo: { email: opts.repondreA } } : {}),
        subject: opts.subject,
        htmlContent: opts.html,
        ...(opts.tag ? { tags: [opts.tag] } : {}),
        ...(opts.headers ? { headers: opts.headers } : {}),
        ...(opts.attachments?.length ? { attachment: opts.attachments.map((a) => ({ name: a.name, content: a.content.toString("base64") })) } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, erreur: await erreurBrevo(res) };
    return { ok: true };
  } catch {
    return { ok: false, erreur: "Brevo : service injoignable" };
  }
}

/** Vérifie la clé API (compte Brevo) sans rien envoyer. */
export async function verifierCompteBrevo(): Promise<{ ok: true; compte: string; entreprise: string | null } | { ok: false; erreur: string }> {
  const cle = process.env.BREVO_API_KEY?.trim();
  if (!cle) return { ok: false, erreur: "Clé BREVO_API_KEY absente" };
  try {
    const res = await fetch(`${API}/account`, { headers: { "api-key": cle, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, erreur: await erreurBrevo(res) };
    const c = (await res.json()) as { email?: string; companyName?: string };
    return { ok: true, compte: c.email ?? "compte Brevo", entreprise: c.companyName ?? null };
  } catch {
    return { ok: false, erreur: "Brevo : service injoignable" };
  }
}
