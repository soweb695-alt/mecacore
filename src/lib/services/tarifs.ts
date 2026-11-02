import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { trierTarifs } from "@/lib/tarifs";
import type { TarifInput } from "@/lib/validators/piece";

const avecPieces = { pieces: { orderBy: { id: "asc" as const }, include: { piece: { select: { reference: true, nom: true } } } } };

/** Création ou modification d'un tarif ; seules les lignes « Forfait » portent des pièces. */
export async function enregistrerTarif(input: TarifInput, id?: string) {
  const pieces = input.type === "FORFAIT" ? (input.pieces ?? []) : [];
  return db.$transaction(async (tx) => {
    if (pieces.length) {
      const n = await tx.piece.count({ where: { id: { in: pieces.map((p) => p.pieceId) }, isActive: true } });
      if (n !== pieces.length) throw new ApiError(400, "Une pièce du forfait est introuvable ou désactivée", "PIECE_INTROUVABLE");
    }
    const data = { type: input.type, libelle: input.libelle, montantHT: input.montantHT, actif: input.actif, description: input.description?.trim() || null };
    if (id) {
      await tx.tarifPiece.deleteMany({ where: { tarifId: id } });
      await tx.tarif.update({ where: { id }, data: { ...data, pieces: { create: pieces } } });
      return { id };
    }
    const t = await tx.tarif.create({ data: { ...data, pieces: { create: pieces } } });
    return { id: t.id };
  });
}

/** Tarifs actifs avec les pièces comprises (éditeur de devis, page Tarifs). */
export async function tarifsActifs() {
  const tarifs = trierTarifs(await db.tarif.findMany({ where: { actif: true }, include: avecPieces }));
  return tarifs.map((t) => ({
    id: t.id,
    type: t.type,
    libelle: t.libelle,
    description: t.description,
    montantHT: Number(t.montantHT),
    actif: t.actif,
    pieces: t.pieces.map((p) => ({ pieceId: p.pieceId, reference: p.piece.reference, nom: p.piece.nom, quantite: p.quantite })),
  }));
}
