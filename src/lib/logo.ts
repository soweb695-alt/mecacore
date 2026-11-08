import "server-only";
import { db } from "@/lib/db";
import { getFichier, typeImage } from "@/lib/storage";

export interface LogoGarage {
  bytes: Buffer;
  mime: "image/png" | "image/jpeg";
}

/**
 * Logo du garage : stocké en base (`logoData`) depuis que l'envoi ne dépend plus de S3.
 * Repli sur l'ancien fichier (`logoUrl`) pour un logo envoyé avant ce changement.
 */
export async function lireLogo(): Promise<LogoGarage | null> {
  const g = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { logoData: true, logoUrl: true } });
  if (!g) return null;
  const buf = g.logoData ? Buffer.from(g.logoData) : g.logoUrl ? await getFichier(g.logoUrl).catch(() => null) : null;
  if (!buf) return null;
  const type = typeImage(buf);
  if (type?.mime !== "image/png" && type?.mime !== "image/jpeg") return null;
  return { bytes: buf, mime: type.mime };
}
