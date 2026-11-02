import { NextResponse } from "next/server";
import { idParam, route } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { pdfDevis } from "@/lib/pdf/devis";

export const GET = route<undefined, undefined, { id: string }>({ permission: ["read", "devis"] }, async ({ params }) => {
  const r = await pdfDevis(idParam.parse(params).id);
  if (!r) throw new ApiError(404, "Devis introuvable", "INTROUVABLE");
  return new NextResponse(Buffer.from(r.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.numero}.pdf"`, "Cache-Control": "private, no-store" },
  });
});
