import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";

/** Les routes cron exigent « Authorization: Bearer <CRON_SECRET> » (comparaison à temps constant). */
export function verifierCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw new ApiError(503, "CRON_SECRET non configuré", "CRON_NON_CONFIGURE");
  const fourni = req.headers.get("authorization") ?? "";
  const attendu = `Bearer ${secret}`;
  const a = Buffer.from(fourni);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, "Non autorisé", "NON_AUTORISE");
}
