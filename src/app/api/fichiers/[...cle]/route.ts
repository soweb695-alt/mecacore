import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { accesOrdre } from "@/lib/services/ordres";
import { getFichier, typeImage } from "@/lib/storage";

/** Sert les signatures et photos aux seuls utilisateurs ayant accès à l'ordre de réparation concerné. */
export const GET = route<undefined, undefined, { cle: string[] }>({ permission: ["read", "photo"] }, async ({ user, params }) => {
  const cle = params.cle.join("/");
  const m = /^(?:signatures\/([a-z0-9]+)\.png|photos\/([a-z0-9]+)\/[0-9a-f-]{36}\.(?:png|jpg|webp))$/.exec(cle);
  if (!m) throw new ApiError(404, "Fichier introuvable", "INTROUVABLE");
  const ordreId = m[1] ?? m[2];
  await accesOrdre(user, ordreId);
  // Le fichier doit être référencé en base (empêche de lire un fichier arbitraire du stockage).
  const reference = m[1]
    ? await db.ordreReparation.count({ where: { id: ordreId, signatureUrl: cle } })
    : await db.photoOR.count({ where: { ordreId, url: cle } });
  if (!reference) throw new ApiError(404, "Fichier introuvable", "INTROUVABLE");
  const buf = await getFichier(cle);
  const type = buf && typeImage(buf);
  if (!buf || !type) throw new ApiError(404, "Fichier introuvable", "INTROUVABLE");
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": type.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
});
