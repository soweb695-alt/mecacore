import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { verifierCron } from "@/lib/cron";
import { ApiError } from "@/lib/errors";

// Désactivé : aucun e-mail ne part automatiquement (y compris le récapitulatif interne des impayés).
// Les impayés se suivent dans l'onglet Relances. La route reste en place (réponse sans envoi).
export async function GET(req: NextRequest) {
  try {
    verifierCron(req);
    return NextResponse.json({ data: { desactive: true, message: "Récapitulatif des impayés : voir l'onglet Relances" } });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message, e.code);
    return jsonError(500, "Erreur interne", "INTERNE");
  }
}
