import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { accesOrdre } from "@/lib/services/ordres";

const query = z.object({ qui: z.enum(["examinant", "responsable"]) });

/** Signature de l'examinant ou du responsable sur la fiche de contrôle (affichage à l'écran). */
export const GET = route<undefined, z.infer<typeof query>, { id: string }>({ permission: ["read", "ordre"], query }, async ({ user, query, params }) => {
  const { id } = idParam.parse(params);
  await accesOrdre(user, id);
  const f = await db.ficheControle.findUnique({ where: { ordreId: id }, select: { examinantSignature: true, responsableSignature: true } });
  const octets = query.qui === "examinant" ? f?.examinantSignature : f?.responsableSignature;
  if (!octets) throw new ApiError(404, "Aucune signature", "INTROUVABLE");
  return new NextResponse(new Uint8Array(octets), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
