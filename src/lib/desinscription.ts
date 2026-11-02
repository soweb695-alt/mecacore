import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function cle(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET manquant");
  return secret;
}

/** Signature infalsifiable du lien de désinscription d'un client (HMAC-SHA256 tronqué, aucun état en base). */
export function signerDesinscription(clientId: string): string {
  return createHmac("sha256", cle()).update(`desinscription:${clientId}`).digest("hex").slice(0, 32);
}

export function verifierDesinscription(clientId: string, signature: string): boolean {
  if (!/^[0-9a-f]{32}$/.test(signature)) return false;
  const attendu = Buffer.from(signerDesinscription(clientId));
  const fourni = Buffer.from(signature);
  return attendu.length === fourni.length && timingSafeEqual(attendu, fourni);
}

export function lienDesinscription(clientId: string): string {
  const base = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/desinscription?c=${encodeURIComponent(clientId)}&s=${signerDesinscription(clientId)}`;
}
