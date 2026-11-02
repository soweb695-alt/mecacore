import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { verifierCron } from "@/lib/cron";
import { ApiError } from "@/lib/errors";
import { envoyerRapportImpayes } from "@/lib/services/factures";

// Planifié chaque lundi matin (voir README) : récapitulatif des factures impayées.
export async function GET(req: NextRequest) {
  try {
    verifierCron(req);
    return NextResponse.json({ data: await envoyerRapportImpayes() });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message, e.code);
    console.error("[cron impayes] erreur");
    return jsonError(500, "Erreur interne", "INTERNE");
  }
}
