import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { verifierCron } from "@/lib/cron";
import { ApiError } from "@/lib/errors";

// Désactivé : aucun e-mail ne part automatiquement. Les rappels de rendez-vous s'envoient depuis le tableau de bord,
// après validation par le garage. La route reste en place (réponse sans envoi) si une ancienne planification l'appelle.
export async function GET(req: NextRequest) {
  try {
    verifierCron(req);
    return NextResponse.json({ data: { desactive: true, message: "Rappels envoyés manuellement depuis le tableau de bord" } });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message, e.code);
    return jsonError(500, "Erreur interne", "INTERNE");
  }
}
