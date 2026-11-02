import "server-only";
import { db } from "@/lib/db";

const FENETRE_MS = 15 * 60 * 1000;
export const MAX_TENTATIVES = 5;
/** Par compte : plus large que par IP (plusieurs postes du garage), mais borne une attaque distribuée sur un e-mail. */
export const MAX_TENTATIVES_COMPTE = 10;

/**
 * IP du client pour la limitation des connexions. `X-Forwarded-For` est complété par chaque proxy :
 * seules les dernières entrées (ajoutées par nos proxys de confiance) sont fiables, les premières sont
 * écrites par le client. TRUSTED_PROXY_HOPS = nombre de proxys devant l'application (1 par défaut :
 * Vercel ou un reverse proxy) ; 0 = connexion directe, l'en-tête est ignoré.
 */
export function clientIp(headers: Record<string, unknown> | undefined, hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1)): string {
  const n = Number.isInteger(hops) && hops >= 0 ? hops : 1;
  const xff = headers?.["x-forwarded-for"];
  const brut = Array.isArray(xff) ? xff.join(",") : xff;
  if (n > 0 && typeof brut === "string") {
    const ips = brut.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = ips[ips.length - n];
    if (ip) return ip.slice(0, 64);
  }
  return "inconnue";
}

/** Limiteur persistant en base (fonctionne sur plusieurs instances serverless). */
export async function estBloque(cle: string, max = MAX_TENTATIVES): Promise<boolean> {
  const ligne = await db.tentativeConnexion.findUnique({ where: { cle } });
  if (!ligne) return false;
  if (Date.now() - ligne.debutFenetre.getTime() >= FENETRE_MS) return false;
  return ligne.compte >= max;
}

export async function enregistrerEchec(cle: string): Promise<void> {
  const ligne = await db.tentativeConnexion.findUnique({ where: { cle } });
  const expire = !ligne || Date.now() - ligne.debutFenetre.getTime() >= FENETRE_MS;
  if (expire) {
    await db.tentativeConnexion.upsert({
      where: { cle },
      create: { cle, compte: 1 },
      update: { compte: 1, debutFenetre: new Date() },
    });
  } else {
    await db.tentativeConnexion.update({ where: { cle }, data: { compte: { increment: 1 } } });
  }
}

export async function reinitialiser(cle: string): Promise<void> {
  await db.tentativeConnexion.deleteMany({ where: { cle } });
}
