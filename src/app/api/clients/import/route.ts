import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { lireFormulaire } from "@/lib/body";
import { ApiError } from "@/lib/errors";
import { ImportError, MAX_TAILLE_IMPORT, lireFichierImport } from "@/lib/import-pieces";
import { importerClients } from "@/lib/services/import-clients";

/**
 * Import en masse de clients (administrateur) : multipart `fichier` + `mode` = « apercu » ou « importer ».
 * Aperçu : analyse sans rien écrire. Importer : applique les lignes valides et liste les erreurs.
 */
export const POST = route<undefined, undefined, Record<string, string>>({ permission: ["create", "client"] }, async ({ req, user }) => {
  if (user.role !== "ADMIN") throw new ApiError(403, "Import réservé à l'administrateur", "INTERDIT");
  const form = await lireFormulaire(req, MAX_TAILLE_IMPORT + 50_000, "Fichier trop volumineux (2 Mo maximum).");
  const fichier = form?.get("fichier");
  const mode = form?.get("mode");
  if (!(fichier instanceof File)) throw new ApiError(400, "Aucun fichier reçu.", "FICHIER_MANQUANT");
  if (mode !== "apercu" && mode !== "importer") throw new ApiError(400, "Mode d'import invalide.", "MODE_INVALIDE");
  try {
    const rows = await lireFichierImport(fichier.name, new Uint8Array(await fichier.arrayBuffer()));
    return NextResponse.json({ data: await importerClients(rows, mode === "importer") });
  } catch (e) {
    if (e instanceof ImportError) throw new ApiError(400, e.message, "FICHIER_INVALIDE");
    throw e;
  }
});
