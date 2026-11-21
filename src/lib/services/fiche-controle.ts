import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { PermissionUser } from "@/lib/permissions";
import type { Prisma, ResultatControle } from "@/generated/prisma/client";
import { pointRenseigne, resultatsAutorises, type Dommage } from "@/lib/fiche-controle";
import { typeImage } from "@/lib/storage";

const MAX_SIGNATURE = 400_000;

const ORDRE_POINTS = [{ categoriePosition: "asc" as const }, { position: "asc" as const }, { id: "asc" as const }];

/**
 * Fiche de contrôle d'un OR : créée à la première ouverture, avec une copie des catégories et points actifs du modèle
 * (Paramètres › Fiche de contrôle ; le modifier ensuite ne change pas les fiches existantes).
 * Deux ouvertures simultanées ne créent qu'une fiche. Les fiches de l'ancien modèle (version 1) restent telles quelles.
 */
export async function obtenirFiche(ordreId: string) {
  const existante = await db.ficheControle.findUnique({ where: { ordreId }, include: { points: { orderBy: ORDRE_POINTS } } });
  if (existante) return existante;
  const categories = await db.categorieControle.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { points: { where: { isActive: true }, orderBy: [{ position: "asc" }, { id: "asc" }] } },
  });
  const points = categories.flatMap((c, ci) => c.points.map((p, i) => ({ libelle: p.libelle, position: i, categorie: c.libelle, categoriePosition: ci, typeStatuts: c.typeStatuts })));
  try {
    return await db.ficheControle.create({ data: { ordreId, version: 2, points: { create: points } }, include: { points: { orderBy: ORDRE_POINTS } } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return db.ficheControle.findUniqueOrThrow({ where: { ordreId }, include: { points: { orderBy: ORDRE_POINTS } } });
    throw e;
  }
}

/** Signature PNG (data URL) → octets, contrôlés. */
function signatureVersOctets(dataUrl: string): Uint8Array<ArrayBuffer> {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new ApiError(400, "Signature invalide", "SIGNATURE_INVALIDE");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > MAX_SIGNATURE) throw new ApiError(413, "Signature trop volumineuse", "TROP_GRAND");
  if (typeImage(buf)?.mime !== "image/png") throw new ApiError(400, "Signature invalide", "SIGNATURE_INVALIDE");
  return Uint8Array.from(buf);
}

export interface SaisieFiche {
  points: { id: string; resultat: ResultatControle }[];
  remarques: string;
  dommages?: Dommage[];
  valider: boolean;
  examinant?: { nom: string; prenom: string; signature?: string };
}

/**
 * Enregistrement (brouillon) ou validation par le technicien. À la validation : chaque point renseigné
 * (une case à cocher décochée vaut « absent »), nom, prénom et signature de l'examinant. Une fiche transmise n'est plus modifiable.
 */
export async function enregistrerFiche(ordreId: string, user: PermissionUser, s: SaisieFiche) {
  const fiche = await obtenirFiche(ordreId);
  if (fiche.statut !== "EN_COURS") throw new ApiError(409, "Cette fiche a déjà été transmise au Magasin", "FICHE_TRANSMISE");
  const parId = new Map(fiche.points.map((p) => [p.id, p]));
  for (const p of s.points) {
    const point = parId.get(p.id);
    if (!point) throw new ApiError(400, "Point de contrôle inconnu", "POINT_INVALIDE");
    if (!resultatsAutorises(point.typeStatuts).includes(p.resultat)) throw new ApiError(400, `Statut invalide pour « ${point.libelle} »`, "RESULTAT_INVALIDE");
  }
  const resultats = new Map(fiche.points.map((p) => [p.id, p.resultat as ResultatControle]));
  for (const p of s.points) resultats.set(p.id, p.resultat);
  if (s.valider && fiche.points.some((p) => !pointRenseigne(p.typeStatuts, resultats.get(p.id)!))) {
    throw new ApiError(400, "Renseignez tous les points de contrôle avant de valider la fiche", "FICHE_INCOMPLETE");
  }
  if (s.valider && !s.examinant?.signature) throw new ApiError(400, "Nom, prénom et signature de l'examinant sont requis pour valider", "EXAMINANT_REQUIS");
  const signature = s.valider && s.examinant?.signature ? signatureVersOctets(s.examinant.signature) : null;
  await db.$transaction(async (tx) => {
    for (const p of s.points) await tx.pointFiche.updateMany({ where: { id: p.id, ficheId: fiche.id }, data: { resultat: p.resultat } });
    // Transition conditionnelle : une validation concurrente ne passe qu'une fois.
    const r = await tx.ficheControle.updateMany({
      where: { id: fiche.id, statut: "EN_COURS" },
      data: {
        remarques: s.remarques.trim() || null,
        ...(s.dommages ? { dommages: s.dommages as unknown as Prisma.InputJsonValue } : {}),
        ...(s.examinant ? { examinantNom: s.examinant.nom, examinantPrenom: s.examinant.prenom } : {}),
        ...(s.valider ? { statut: "TRANSMISE", valideeLe: new Date(), valideeParId: user.id, examinantSignature: signature } : {}),
      },
    });
    if (r.count === 0) throw new ApiError(409, "Cette fiche a déjà été transmise au Magasin", "FICHE_TRANSMISE");
  });
  return { id: fiche.id, statut: s.valider ? ("TRANSMISE" as const) : ("EN_COURS" as const) };
}

/** Vérification et signature du responsable (Magasin ou administrateur) sur une fiche transmise ou traitée. */
export async function verifierFiche(ordreId: string, user: PermissionUser, v: { nom: string; signature: string }) {
  const octets = signatureVersOctets(v.signature);
  const r = await db.ficheControle.updateMany({
    where: { ordreId, statut: { in: ["TRANSMISE", "TRAITEE"] } },
    data: { responsableNom: v.nom, responsableSignature: octets, verifieeLe: new Date(), verifieeParId: user.id },
  });
  if (r.count === 0) throw new ApiError(409, "La fiche doit d'abord être validée par l'atelier", "STATUT_INVALIDE");
  return { ok: true };
}

/** Signatures (PNG) d'une fiche, pour le PDF ; non chargées par les lectures courantes. */
export async function signaturesFiche(ficheId: string) {
  return db.ficheControle.findUnique({ where: { id: ficheId }, select: { examinantSignature: true, responsableSignature: true } });
}

/**
 * Le Magasin renvoie la fiche à l'atelier pour correction. Si l'OR était déjà terminé, il repasse « En cours »
 * et son brouillon de facture (jamais émis, sans numéro) est supprimé : il sera recréé à la prochaine fin d'OR.
 */
export async function renvoyerALAtelier(ordreId: string) {
  return db.$transaction(async (tx) => {
    // Les signatures sont effacées : l'examinant re-signe après correction, le responsable vérifie à nouveau.
    const r = await tx.ficheControle.updateMany({
      where: { ordreId, statut: "TRANSMISE" },
      data: { statut: "EN_COURS", valideeLe: null, valideeParId: null, examinantSignature: null, responsableNom: null, responsableSignature: null, verifieeLe: null, verifieeParId: null },
    });
    if (r.count === 0) throw new ApiError(409, "Cette fiche n'est pas en attente au Magasin", "STATUT_INVALIDE");
    const o = await tx.ordreReparation.findUnique({ where: { id: ordreId }, select: { statut: true, devisId: true } });
    if (o?.statut === "A_TRAITER_MAGASIN") {
      await tx.ordreReparation.update({ where: { id: ordreId }, data: { statut: "EN_COURS" } });
      await tx.facture.deleteMany({ where: { devisId: o.devisId, statut: "BROUILLON" } });
    }
    return { ok: true };
  });
}
