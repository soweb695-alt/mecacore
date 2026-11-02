import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { verifierCron } from "@/lib/cron";
import { ApiError } from "@/lib/errors";
import { envoyerRappelsRdv } from "@/lib/services/rappels";

// Planifié chaque jour (voir README) : rappels de rendez-vous J-1 et J-7.
export async function GET(req: NextRequest) {
  try {
    verifierCron(req);
    return NextResponse.json({ data: await envoyerRappelsRdv() });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message, e.code);
    console.error("[cron rappels] erreur");
    return jsonError(500, "Erreur interne", "INTERNE");
  }
}
