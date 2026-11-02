import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { lireFormulaire } from "@/lib/body";
import { ApiError } from "@/lib/errors";
import { getFichier, putFichier, typeImage } from "@/lib/storage";

const MAX_LOGO = 1_000_000;

/** Aperçu du logo (onglet « Mon Garage »). */
export const GET = route({ permission: ["update", "parametre"] }, async () => {
  const g = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { logoUrl: true } });
  const buf = g?.logoUrl ? await getFichier(g.logoUrl) : null;
  const type = buf && typeImage(buf);
  if (!buf || !type) throw new ApiError(404, "Aucun logo", "INTROUVABLE");
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": type.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});

/** Envoi du logo : PNG ou JPEG (formats intégrables dans les PDF), 1 Mo maximum. */
export const POST = route({ permission: ["update", "parametre"] }, async ({ req }) => {
  // Taille contrôlée pendant la lecture (marge pour l'enveloppe multipart), pas après.
  const form = await lireFormulaire(req, MAX_LOGO + 50_000, "Logo trop volumineux (1 Mo maximum)");
  const fichier = form?.get("logo");
  if (!(fichier instanceof File)) throw new ApiError(400, "Choisissez une image", "FICHIER_REQUIS");
  if (fichier.size > MAX_LOGO) throw new ApiError(413, "Logo trop volumineux (1 Mo maximum)", "TROP_GRAND");
  const buf = Buffer.from(await fichier.arrayBuffer());
  const type = typeImage(buf);
  if (!type || (type.mime !== "image/png" && type.mime !== "image/jpeg")) throw new ApiError(400, "Format non pris en charge : PNG ou JPEG uniquement", "FORMAT_INVALIDE");
  const key = `garage/logo-${Date.now()}.${type.ext}`;
  await putFichier(key, buf, type.mime);
  await db.parametreGarage.update({ where: { id: 1 }, data: { logoUrl: key } });
  return { ok: true };
});

export const DELETE = route({ permission: ["update", "parametre"] }, async () => {
  await db.parametreGarage.update({ where: { id: 1 }, data: { logoUrl: null } });
  return { ok: true };
});
