import "server-only";
import { db, type Tx } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { parisVersUtc } from "@/lib/time";

export interface RdvInput {
  clientId: string;
  vehiculeId: string;
  userId: string;
  devisId?: string | null;
  debut: string;
  fin: string;
  motif?: string;
}

const DUREE_MAX_MS = 12 * 3600 * 1000;

/**
 * Crée ou déplace un rendez-vous dans la transaction fournie. Un collaborateur ne peut avoir deux
 * rendez-vous qui se chevauchent : contrôle et écriture se font sous verrou consultatif par collaborateur.
 */
export async function enregistrerRdvTx(tx: Tx, input: RdvInput, id?: string) {
  const debut = parisVersUtc(input.debut);
  const fin = parisVersUtc(input.fin);
  if (fin.getTime() - debut.getTime() > DUREE_MAX_MS) throw new ApiError(400, "Un rendez-vous ne peut pas dépasser 12 heures", "DUREE_INVALIDE");

  // Requêtes séquentielles : une transaction n'utilise qu'une seule connexion.
  const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { isActive: true, anonymiseLe: true } });
  const vehicule = await tx.vehicule.findUnique({ where: { id: input.vehiculeId }, select: { clientId: true } });
  const collab = await tx.user.findUnique({ where: { id: input.userId }, select: { isActive: true } });
  if (!client || !client.isActive || client.anonymiseLe) throw new ApiError(400, "Client introuvable", "CLIENT_INTROUVABLE");
  if (!vehicule || vehicule.clientId !== input.clientId) throw new ApiError(400, "Ce véhicule n'appartient pas à ce client", "VEHICULE_INVALIDE");
  if (!collab?.isActive) throw new ApiError(400, "Collaborateur introuvable", "COLLABORATEUR_INVALIDE");
  if (input.devisId) {
    const d = await tx.devis.findUnique({ where: { id: input.devisId }, select: { clientId: true } });
    if (!d || d.clientId !== input.clientId) throw new ApiError(400, "Ce devis n'appartient pas à ce client", "DEVIS_INVALIDE");
  }

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;
  const conflit = await tx.rendezVous.findFirst({
    where: {
      userId: input.userId,
      statut: { notIn: ["ANNULE", "NO_SHOW"] },
      debut: { lt: fin },
      fin: { gt: debut },
      ...(id ? { id: { not: id } } : {}),
    },
    select: { debut: true, fin: true },
  });
  if (conflit) {
    throw new ApiError(409, "Ce collaborateur a déjà un rendez-vous sur ce créneau", "CONFLIT_RDV", { debut: conflit.debut, fin: conflit.fin });
  }
  const data = {
    clientId: input.clientId,
    vehiculeId: input.vehiculeId,
    userId: input.userId,
    devisId: input.devisId ?? null,
    debut,
    fin,
    motif: input.motif?.trim() || null,
  };
  const r = id ? await tx.rendezVous.update({ where: { id }, data }) : await tx.rendezVous.create({ data });
  return { id: r.id };
}

export async function enregistrerRdv(input: RdvInput, id?: string) {
  return db.$transaction((tx) => enregistrerRdvTx(tx, input, id));
}
