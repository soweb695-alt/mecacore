import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { facturesVersPdf, facturesVersXlsx } from "@/lib/export-factures";
import { exportFacturesSchema } from "@/lib/validators/facture";

const body = exportFacturesSchema.extend({ format: z.enum(["xlsx", "pdf"]) });

/** Export des factures cochées dans la liste : classeur Excel ou PDF groupé. */
export const POST = route({ permission: ["export", "facture"], body }, async ({ body }) => {
  const date = new Date().toISOString().slice(0, 10);
  if (body.format === "pdf") {
    const pdf = await facturesVersPdf(body.ids);
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="factures-${date}.pdf"`, "Cache-Control": "private, no-store" } });
  }
  const xlsx = await facturesVersXlsx(body.ids);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="factures-${date}.xlsx"`, "Cache-Control": "private, no-store" },
  });
});
