import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { lireFormulaire } from "@/lib/body";
import { ApiError } from "@/lib/errors";
import { typeImage } from "@/lib/storage";

/** 2 Mo : une photo de téléphone recadrée ou une image de catalogue. */
const MAX_IMAGE_PIECE = 2_000_000;
const FORMATS = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Image de la pièce. L'URL porte la version (`?v=`) : le navigateur la garde en cache tant qu'elle ne change pas. */
export const GET = route<undefined, undefined, { id: string }>({ permission: ["read", "piece"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  const img = await db.pieceImage.findUnique({ where: { pieceId: id } });
  if (!img) throw new ApiError(404, "Aucune image", "INTROUVABLE");
  return new NextResponse(new Uint8Array(img.data), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});

/** Envoi ou remplacement de l'image : PNG, JPEG ou WebP, 2 Mo maximum (type contrôlé sur le contenu, pas sur le nom). */
export const POST = route<undefined, undefined, { id: string }>({ permission: ["update", "piece"] }, async ({ req, params }) => {
  const { id } = idParam.parse(params);
  const form = await lireFormulaire(req, MAX_IMAGE_PIECE + 50_000, "Image trop volumineuse (2 Mo maximum)");
  const fichier = form?.get("image");
  if (!(fichier instanceof File)) throw new ApiError(400, "Choisissez une image", "FICHIER_REQUIS");
  if (fichier.size > MAX_IMAGE_PIECE) throw new ApiError(413, "Image trop volumineuse (2 Mo maximum)", "TROP_GRAND");
  const buf = Buffer.from(await fichier.arrayBuffer());
  const type = typeImage(buf);
  if (!type || !FORMATS.has(type.mime)) throw new ApiError(400, "Format non pris en charge : PNG, JPEG ou WebP", "FORMAT_INVALIDE");
  const piece = await db.piece.findUnique({ where: { id }, select: { id: true } });
  if (!piece) throw new ApiError(404, "Pièce introuvable", "INTROUVABLE");
  const maj = new Date();
  await db.$transaction([
    db.pieceImage.upsert({ where: { pieceId: id }, create: { pieceId: id, data: new Uint8Array(buf), mime: type.mime }, update: { data: new Uint8Array(buf), mime: type.mime } }),
    db.piece.update({ where: { id }, data: { imageMaj: maj } }),
  ]);
  return { imageMaj: maj.toISOString() };
});

export const DELETE = route<undefined, undefined, { id: string }>({ permission: ["update", "piece"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  await db.$transaction([db.pieceImage.deleteMany({ where: { pieceId: id } }), db.piece.update({ where: { id }, data: { imageMaj: null } })]);
  return { ok: true };
});
