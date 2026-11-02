import { NextResponse } from "next/server";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pdfBonLivraison } from "@/lib/pdf/bl";

export const GET = route<undefined, undefined, { id: string }>({ permission: ["read", "bonLivraison"] }, async ({ params }) => {
  const r = await pdfBonLivraison(idParam.parse(params).id);
  if (!r) throw new ApiError(404, "Bon de livraison introuvable", "INTROUVABLE");
  return new NextResponse(Buffer.from(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.numero}.pdf"`, "Cache-Control": "private, no-store" },
  });
});
