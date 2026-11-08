import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { filtreClient } from "@/lib/client-search";
import { prochainNumero } from "@/lib/numbering";
import { nn } from "@/lib/validators/common";
import { retourSchema, type RetourInput } from "@/lib/validators/retour";

/** Contrôle les liens (client actif, OR, pièce) : un OR rattaché impose son client. */
async function liens(tx: Prisma.TransactionClient, input: ReturnType<typeof retourSchema.parse>) {
  let clientId = input.clientId ?? null;
  if (input.ordreId) {
    const o = await tx.ordreReparation.findUnique({ where: { id: input.ordreId }, select: { devis: { select: { clientId: true } } } });
    if (!o) throw new ApiError(400, "Ordre de réparation introuvable", "ORDRE_INTROUVABLE");
    if (clientId && clientId !== o.devis.clientId) throw new ApiError(400, "Cet ordre de réparation appartient à un autre client", "CLIENT_INCOHERENT");
    clientId = o.devis.clientId;
  }
  if (clientId) {
    const c = await tx.client.findUnique({ where: { id: clientId }, select: { anonymiseLe: true } });
    if (!c || c.anonymiseLe) throw new ApiError(400, "Client introuvable", "CLIENT_INTROUVABLE");
  }
  if (input.pieceId && !(await tx.piece.count({ where: { id: input.pieceId } }))) throw new ApiError(400, "Pièce introuvable", "PIECE_INTROUVABLE");
  return { clientId, ordreId: input.ordreId ?? null, pieceId: input.pieceId ?? null };
}

function donnees(input: ReturnType<typeof retourSchema.parse>) {
  return {
    type: input.type,
    statut: input.statut,
    designation: input.designation,
    reference: nn(input.reference)?.toUpperCase() ?? null,
    quantite: input.quantite,
    montantConsigneHT: input.montantConsigneHT ?? null,
    fournisseur: nn(input.fournisseur),
    notes: nn(input.notes),
    ...(input.dateEntree ? { dateEntree: new Date(`${input.dateEntree}T12:00:00Z`) } : {}),
  };
}

export async function creerRetour(userId: string, raw: RetourInput) {
  const input = retourSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const l = await liens(tx, input);
    const numero = await prochainNumero(tx, "RET");
    const r = await tx.retourPiece.create({
      data: { numero, userId, ...donnees(input), ...l, dateTraitement: input.statut === "EN_ATTENTE" ? null : new Date() },
      select: { id: true, numero: true },
    });
    return r;
  });
}

export async function modifierRetour(id: string, raw: RetourInput) {
  const input = retourSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const existant = await tx.retourPiece.findUnique({ where: { id }, select: { statut: true, dateTraitement: true } });
    if (!existant) throw new ApiError(404, "Retour introuvable", "INTROUVABLE");
    const l = await liens(tx, input);
    // Date de traitement : posée quand le retour quitte « En attente », retirée s'il y revient.
    const dateTraitement = input.statut === "EN_ATTENTE" ? null : (existant.dateTraitement ?? new Date());
    await tx.retourPiece.update({ where: { id }, data: { ...donnees(input), ...l, dateTraitement } });
    return { id };
  });
}

export async function supprimerRetour(id: string) {
  await db.retourPiece.delete({ where: { id } });
  return { ok: true };
}

export function filtreRetours(q: { q?: string; type?: string; statut?: string; clientId?: string; ordreId?: string }): Prisma.RetourPieceWhereInput {
  return {
    ...(q.type ? { type: q.type as Prisma.RetourPieceWhereInput["type"] } : {}),
    ...(q.statut ? { statut: q.statut as Prisma.RetourPieceWhereInput["statut"] } : {}),
    ...(q.clientId ? { clientId: q.clientId } : {}),
    ...(q.ordreId ? { ordreId: q.ordreId } : {}),
    ...(q.q
      ? {
          OR: [
            { numero: { contains: q.q, mode: "insensitive" } },
            { designation: { contains: q.q, mode: "insensitive" } },
            { reference: { contains: q.q, mode: "insensitive" } },
            { fournisseur: { contains: q.q, mode: "insensitive" } },
            { client: filtreClient(q.q) },
            { ordre: { numero: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

/** Ordres de réparation proposés dans le formulaire (numéro, client ou plaque). */
export async function rechercherOrdres(q: string | undefined, clientId?: string) {
  const ordres = await db.ordreReparation.findMany({
    where: {
      ...(clientId ? { devis: { clientId } } : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: "insensitive" } },
              { devis: { client: filtreClient(q) } },
              { devis: { vehicule: { immatriculation: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      numero: true,
      devis: {
        select: {
          client: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true } },
          vehicule: { select: { immatriculation: true, marque: true, modele: true } },
        },
      },
    },
  });
  return ordres.map((o) => ({ id: o.id, numero: o.numero, client: o.devis.client, vehicule: o.devis.vehicule }));
}
