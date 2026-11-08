import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { lireFormulaire } from "@/lib/body";
import { ApiError } from "@/lib/errors";
import { lireLogo } from "@/lib/logo";
import { typeImage } from "@/lib/storage";

const MAX_LOGO = 1_000_000;

/** Aperçu du logo (onglet « Mon Garage »). */
export const GET = route({ permission: ["update", "parametre"] }, async () => {
  const logo = await lireLogo();
  if (!logo) throw new ApiError(404, "Aucun logo", "INTROUVABLE");
  return new NextResponse(new Uint8Array(logo.bytes), { headers: { "Content-Type": logo.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});

/**
 * Envoi du logo : PNG ou JPEG (formats intégrables dans les PDF), 1 Mo maximum.
 * Stocké en base de données : l'envoi fonctionne aussi sur Vercel, où le disque est en lecture seule et sans S3.
 */
export const POST = route({ permission: ["update", "parametre"] }, async ({ req }) => {
  // Taille contrôlée pendant la lecture (marge pour l'enveloppe multipart), pas après.
  const form = await lireFormulaire(req, MAX_LOGO + 50_000, "Logo trop volumineux (1 Mo maximum)");
  const fichier = form?.get("logo");
  if (!(fichier instanceof File)) throw new ApiError(400, "Choisissez une image", "FICHIER_REQUIS");
  if (fichier.size > MAX_LOGO) throw new ApiError(413, "Logo trop volumineux (1 Mo maximum)", "TROP_GRAND");
  const buf = Buffer.from(await fichier.arrayBuffer());
  const type = typeImage(buf);
  if (!type || (type.mime !== "image/png" && type.mime !== "image/jpeg")) {
    throw new ApiError(400, "Format non pris en charge : enregistrez votre logo en PNG ou JPEG", "FORMAT_INVALIDE");
  }
  const existe = await db.parametreGarage.count({ where: { id: 1 } });
  if (!existe) throw new ApiError(409, "Enregistrez d'abord les coordonnées du garage", "PARAMETRES_MANQUANTS");
  await db.parametreGarage.update({
    where: { id: 1 },
    data: { logoData: new Uint8Array(buf), logoMime: type.mime, logoMaj: new Date(), logoUrl: null },
  });
  return { ok: true };
});

export const DELETE = route({ permission: ["update", "parametre"] }, async () => {
  await db.parametreGarage.update({ where: { id: 1 }, data: { logoUrl: null, logoData: null, logoMime: null, logoMaj: null } });
  return { ok: true };
});
