import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { PermissionUser } from "@/lib/permissions";
import type { ResultatControle } from "@/generated/prisma/client";

/**
 * Fiche de contrôle d'un OR : créée à la première ouverture, avec une copie des points actifs du modèle
 * (modifier le modèle ensuite ne change pas les fiches existantes). Deux ouvertures simultanées ne créent qu'une fiche.
 */
export async function obtenirFiche(ordreId: string) {
  const existante = await db.ficheControle.findUnique({ where: { ordreId }, include: { points: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
  if (existante) return existante;
  const modele = await db.pointControle.findMany({ where: { isActive: true }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  try {
    return await db.ficheControle.create({
      data: { ordreId, points: { create: modele.map((p, i) => ({ libelle: p.libelle, position: i })) } },
      include: { points: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return db.ficheControle.findUniqueOrThrow({ where: { ordreId }, include: { points: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
    throw e;
  }
}

export interface SaisieFiche {
  points: { id: string; resultat: ResultatControle }[];
  remarques: string;
  valider: boolean;
}

/** Enregistrement (brouillon) ou validation par le technicien. Une fiche transmise n'est plus modifiable. */
export async function enregistrerFiche(ordreId: string, user: PermissionUser, s: SaisieFiche) {
  const fiche = await obtenirFiche(ordreId);
  if (fiche.statut !== "EN_COURS") throw new ApiError(409, "Cette fiche a déjà été transmise au Magasin", "FICHE_TRANSMISE");
  const ids = new Set(fiche.points.map((p) => p.id));
  if (s.points.some((p) => !ids.has(p.id))) throw new ApiError(400, "Point de contrôle inconnu", "POINT_INVALIDE");
  const resultats = new Map(fiche.points.map((p) => [p.id, p.resultat as ResultatControle]));
  for (const p of s.points) resultats.set(p.id, p.resultat);
  if (s.valider && [...resultats.values()].some((r) => r === "NON_VERIFIE")) {
    throw new ApiError(400, "Renseignez tous les points de contrôle avant de valider la fiche", "FICHE_INCOMPLETE");
  }
  await db.$transaction(async (tx) => {
    for (const p of s.points) await tx.pointFiche.updateMany({ where: { id: p.id, ficheId: fiche.id }, data: { resultat: p.resultat } });
    // Transition conditionnelle : une validation concurrente ne passe qu'une fois.
    const r = await tx.ficheControle.updateMany({
      where: { id: fiche.id, statut: "EN_COURS" },
      data: { remarques: s.remarques.trim() || null, ...(s.valider ? { statut: "TRANSMISE", valideeLe: new Date(), valideeParId: user.id } : {}) },
    });
    if (r.count === 0) throw new ApiError(409, "Cette fiche a déjà été transmise au Magasin", "FICHE_TRANSMISE");
  });
  return { id: fiche.id, statut: s.valider ? ("TRANSMISE" as const) : ("EN_COURS" as const) };
}

/**
 * Le Magasin renvoie la fiche à l'atelier pour correction. Si l'OR était déjà terminé, il repasse « En cours »
 * et son brouillon de facture (jamais émis, sans numéro) est supprimé : il sera recréé à la prochaine fin d'OR.
 */
export async function renvoyerALAtelier(ordreId: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.ficheControle.updateMany({ where: { ordreId, statut: "TRANSMISE" }, data: { statut: "EN_COURS", valideeLe: null, valideeParId: null } });
    if (r.count === 0) throw new ApiError(409, "Cette fiche n'est pas en attente au Magasin", "STATUT_INVALIDE");
    const o = await tx.ordreReparation.findUnique({ where: { id: ordreId }, select: { statut: true, devisId: true } });
    if (o?.statut === "A_TRAITER_MAGASIN") {
      await tx.ordreReparation.update({ where: { id: ordreId }, data: { statut: "EN_COURS" } });
      await tx.facture.deleteMany({ where: { devisId: o.devisId, statut: "BROUILLON" } });
    }
    return { ok: true };
  });
}
