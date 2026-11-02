import { NextResponse } from "next/server";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pdfFacture } from "@/lib/pdf/facture";

export const GET = route<undefined, undefined, { id: string }>({ permission: ["read", "facture"] }, async ({ params }) => {
  const { id } = idParam.parse(params);
  const r = await pdfFacture(id);
  if (!r) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
  return new NextResponse(Buffer.from(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.nom}.pdf"`, "Cache-Control": "private, no-store" },
  });
});
