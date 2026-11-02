import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { verifierCron } from "@/lib/cron";
import { ApiError } from "@/lib/errors";
import { appliquerRetention } from "@/lib/services/retention";

// Planifié chaque mois (voir README) : purge RGPD des anciens messages et clients inactifs.
export async function GET(req: NextRequest) {
  try {
    verifierCron(req);
    return NextResponse.json({ data: await appliquerRetention() });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message, e.code);
    console.error("[cron retention] erreur");
    return jsonError(500, "Erreur interne", "INTERNE");
  }
}
