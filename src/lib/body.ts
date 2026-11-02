import "server-only";
import { ApiError } from "@/lib/errors";

/**
 * Lit le corps de la requête en flux et s'arrête dès que `max` octets sont dépassés.
 * `Content-Length` est absent des envois « chunked » : on ne peut pas s'y fier seul.
 */
export async function lireCorps(req: Request, max: number, message = "Requête trop volumineuse"): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length") ?? 0) > max) throw new ApiError(413, message, "TROP_GRAND");
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, message, "TROP_GRAND");
    }
    morceaux.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) {
    out.set(m, pos);
    pos += m.byteLength;
  }
  return out;
}

/** Corps JSON borné ; `null` si le JSON est invalide. */
export async function lireJson(req: Request, max: number): Promise<unknown> {
  const octets = await lireCorps(req, max);
  try {
    return JSON.parse(new TextDecoder().decode(octets));
  } catch {
    return null;
  }
}

/** Formulaire multipart borné (photos, logo, import) ; `null` si le corps n'est pas un formulaire valide. */
export async function lireFormulaire(req: Request, max: number, message?: string): Promise<FormData | null> {
  const octets = await lireCorps(req, max, message);
  return new Response(new Blob([octets as Uint8Array<ArrayBuffer>]), { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData().catch(() => null);
}
