import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { can, type PermissionUser } from "@/lib/permissions";
import { cloturerOrdre, creerBrouillonTx } from "@/lib/services/factures";
import { putFichier, typeImage } from "@/lib/storage";

/** Charge l'OR et vérifie que l'utilisateur y a accès (le mécanicien ne voit que ses OR assignés). */
export async function accesOrdre(user: PermissionUser, ordreId: string) {
  const ordre = await db.ordreReparation.findUnique({ where: { id: ordreId }, select: { id: true, userId: true, statut: true } });
  if (!ordre) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
  if (!can(user, "read", "ordre", ordre.userId ?? "")) throw new ApiError(403, "Accès refusé", "INTERDIT");
  return ordre;
}

const MAX_SIGNATURE = 400_000;
const MAX_PHOTO = 5_000_000;

export async function enregistrerSignature(ordreId: string, dataUrl: string) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ApiError(400, "Signature invalide", "SIGNATURE_INVALIDE");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > MAX_SIGNATURE) throw new ApiError(413, "Signature trop volumineuse", "TROP_GRAND");
  if (typeImage(buf)?.mime !== "image/png") throw new ApiError(400, "Signature invalide", "SIGNATURE_INVALIDE");

  const key = `signatures/${ordreId}.png`;
  // Transition conditionnelle : une seule signature possible.
  const r = await db.ordreReparation.updateMany({
    where: { id: ordreId, statut: "EN_ATTENTE_SIGNATURE" },
    data: { statut: "SIGNE", signatureUrl: key, signeLe: new Date() },
  });
  if (r.count === 0) throw new ApiError(409, "Cet ordre est déjà signé", "DEJA_SIGNE");
  await putFichier(key, buf, "image/png");
  return { key };
}

export async function ajouterPhoto(ordreId: string, userId: string, fichier: File) {
  if (fichier.size > MAX_PHOTO) throw new ApiError(413, "Photo trop volumineuse (5 Mo maximum)", "TROP_GRAND");
  const buf = Buffer.from(await fichier.arrayBuffer());
  const type = typeImage(buf);
  if (!type) throw new ApiError(400, "Format d'image non pris en charge (PNG, JPEG ou WebP)", "FORMAT_INVALIDE");
  const key = `photos/${ordreId}/${randomUUID()}.${type.ext}`;
  await putFichier(key, buf, type.mime);
  const photo = await db.photoOR.create({ data: { ordreId, userId, url: key } });
  return { id: photo.id, url: key };
}

/** L'atelier démarre les travaux d'un OR signé. */
export async function demarrerTravaux(ordreId: string) {
  const r = await db.ordreReparation.updateMany({ where: { id: ordreId, statut: "SIGNE" }, data: { statut: "EN_COURS" } });
  if (r.count === 0) {
    const o = await db.ordreReparation.findUnique({ where: { id: ordreId }, select: { statut: true } });
    if (!o) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
    throw new ApiError(409, o.statut === "EN_ATTENTE_SIGNATURE" ? "L'ordre doit d'abord être signé" : "Les travaux ont déjà démarré", "STATUT_INVALIDE");
  }
  return { id: ordreId };
}

/**
 * Fin des travaux par l'atelier (fiche de contrôle validée exigée) : kilométrage relevé, OR « À traiter par le Magasin »
 * et facture brouillon préparée pour le Magasin. Le kilométrage met aussi à jour la fiche du véhicule.
 */
export async function terminerOrdre(ordreId: string, kilometrage: number) {
  return db.$transaction(async (tx) => {
    const ordre = await tx.ordreReparation.findUnique({ where: { id: ordreId }, select: { statut: true, fiche: { select: { statut: true } }, devis: { select: { vehiculeId: true } } } });
    if (!ordre) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
    if (!["SIGNE", "EN_COURS"].includes(ordre.statut)) {
      throw new ApiError(409, ordre.statut === "EN_ATTENTE_SIGNATURE" ? "L'ordre doit d'abord être signé" : "Cet ordre est déjà terminé", "STATUT_INVALIDE");
    }
    if (ordre.fiche?.statut !== "TRANSMISE") throw new ApiError(409, "Validez d'abord la fiche de contrôle", "FICHE_NON_VALIDEE");
    const r = await tx.ordreReparation.updateMany({ where: { id: ordreId, statut: { in: ["SIGNE", "EN_COURS"] } }, data: { statut: "A_TRAITER_MAGASIN", kilometrage } });
    if (r.count === 0) throw new ApiError(409, "Cet ordre est déjà terminé", "STATUT_INVALIDE");
    if (ordre.devis.vehiculeId) await tx.vehicule.update({ where: { id: ordre.devis.vehiculeId }, data: { kilometrage } });
    const facture = await creerBrouillonTx(tx, ordreId);
    // Devis déjà facturé directement par le Magasin : rien à traiter, l'OR est clôturé.
    if (facture.statut !== "BROUILLON") await cloturerOrdre(tx, ordreId);
    return { id: ordreId, factureId: facture.id };
  });
}

