import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canSeeMargins, canSeePurchasePrice, type PermissionUser } from "@/lib/permissions";
import { nn } from "@/lib/validators/common";
import type { PieceInput } from "@/lib/validators/piece";

export const PAGE_SIZE_PIECES = 25;

type PieceRow = Awaited<ReturnType<typeof db.piece.findFirstOrThrow>>;

/**
 * Vue d'une pièce adaptée au rôle : prix d'achat réservé à l'admin et au Magasin, marge à l'admin seul.
 * Ces données ne sortent jamais du serveur pour un rôle non autorisé.
 */
export function pieceVue(p: PieceRow, user: PermissionUser) {
  const marges = canSeeMargins(user);
  const achatVisible = canSeePurchasePrice(user);
  const vente = Number(p.prixVenteHT);
  const achat = Number(p.prixAchatHT);
  const { prixAchatHT: _a, prixVenteHT: _v, ...reste } = p;
  void _a;
  void _v;
  return {
    ...reste,
    prixVenteHT: vente,
    ...(achatVisible ? { prixAchatHT: achat } : {}),
    ...(marges ? { margePct: vente > 0 ? Math.round(((vente - achat) / vente) * 100) : 0 } : {}),
    enAlerte: p.stock <= p.seuilAlerte,
  };
}

export function pieceData(b: PieceInput, user: PermissionUser, creation: boolean): Prisma.PieceCreateInput {
  return {
    reference: b.reference,
    nom: b.nom,
    marque: nn(b.marque),
    fournisseur: nn(b.fournisseur),
    categorie: nn(b.categorie),
    // Le prix d'achat n'est modifiable que par ceux qui le voient (admin, Magasin).
    ...(canSeePurchasePrice(user) && b.prixAchatHT !== undefined ? { prixAchatHT: b.prixAchatHT } : creation ? { prixAchatHT: 0 } : {}),
    prixVenteHT: b.prixVenteHT,
    stock: b.stock,
    seuilAlerte: b.seuilAlerte,
    taillePneu: nn(b.taillePneu),
    referencesCroisees: Array.from(new Set(b.referencesCroisees.map((r) => r.toUpperCase()))),
  };
}

/** Référence normalisée : majuscules, sans espaces ni ponctuation (« 0 986-452 041 » = « 0986452041 »). */
export const normaliserRef = (r: string) => r.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Pièces dont une référence croisée correspond à la saisie (ponctuation ignorée, 3 caractères minimum). */
async function idsParReferenceCroisee(q: string): Promise<string[]> {
  const n = normaliserRef(q);
  if (n.length < 3) return [];
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM "Piece" p
    WHERE p."isActive" = true AND EXISTS (
      SELECT 1 FROM unnest(p."referencesCroisees") r WHERE regexp_replace(upper(r), '[^A-Z0-9]', '', 'g') LIKE ${"%" + n + "%"}
    )`;
  return rows.map((r) => r.id);
}

export async function rechercherPieces(user: PermissionUser, opts: { q?: string; categorie?: string; bas?: boolean; page: number }) {
  const q = opts.q?.trim();
  const croisees = q ? await idsParReferenceCroisee(q) : [];
  const base: Prisma.PieceWhereInput = {
    isActive: true,
    ...(opts.categorie ? { categorie: opts.categorie } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { nom: { contains: q, mode: "insensitive" } },
            { marque: { contains: q, mode: "insensitive" } },
            { taillePneu: { contains: q, mode: "insensitive" } },
            { referencesCroisees: { has: q.toUpperCase() } },
            ...(croisees.length ? [{ id: { in: croisees } }] : []),
          ],
        }
      : {}),
  };
  // "Sous le seuil" : comparaison entre deux colonnes → on filtre via SQL brut sur les identifiants.
  let where = base;
  if (opts.bas) {
    const ids = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Piece" WHERE "isActive" = true AND stock <= "seuilAlerte"`;
    where = { AND: [base, { id: { in: ids.map((r) => r.id) } }] };
  }
  const alertes = await compterAlertes();
  const nq = q ? normaliserRef(q) : "";
  // Une pièce trouvée uniquement par sa référence croisée est signalée comme « équivalent » de la référence saisie.
  const marquerEquivalent = <T extends { reference: string; nom: string; referencesCroisees: string[] }>(p: T) => {
    if (!q) return null;
    const direct = [p.reference, p.nom].some((v) => v.toLowerCase().includes(q.toLowerCase()));
    if (direct) return null;
    return p.referencesCroisees.find((r) => nq && normaliserRef(r).includes(nq)) ?? null;
  };
  let total: number;
  let rows: PieceRow[];
  if (q) {
    // Recherche : les pièces réellement en stock remontent d'abord (tri fait ici, le volume d'une recherche reste faible).
    const tout = await db.piece.findMany({ where, orderBy: { nom: "asc" }, take: 300 });
    tout.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));
    total = tout.length;
    rows = tout.slice((opts.page - 1) * PAGE_SIZE_PIECES, opts.page * PAGE_SIZE_PIECES);
  } else {
    [total, rows] = await Promise.all([db.piece.count({ where }), db.piece.findMany({ where, orderBy: { nom: "asc" }, skip: (opts.page - 1) * PAGE_SIZE_PIECES, take: PAGE_SIZE_PIECES })]);
  }
  return {
    total,
    alertes,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE_PIECES)),
    items: rows.map((p) => ({ ...pieceVue(p, user), equivalentDe: marquerEquivalent(p) ? q! : null, referenceCroisee: marquerEquivalent(p) })),
  };
}

export async function compterAlertes(): Promise<number> {
  const r = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Piece" WHERE "isActive" = true AND stock <= "seuilAlerte"`;
  return Number(r[0]?.n ?? 0);
}

export async function piecesEnAlerte(limit = 5) {
  return db.$queryRaw<{ id: string; nom: string; stock: number; seuilAlerte: number }[]>`
    SELECT id, nom, stock, "seuilAlerte" FROM "Piece"
    WHERE "isActive" = true AND stock <= "seuilAlerte" ORDER BY (stock - "seuilAlerte") ASC, nom ASC LIMIT ${limit}`;
}
