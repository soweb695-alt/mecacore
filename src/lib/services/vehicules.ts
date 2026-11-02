import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { nn } from "@/lib/validators/common";
import type { VehiculeInput } from "@/lib/validators/vehicule";

export function vehiculeData(b: VehiculeInput): Prisma.VehiculeUncheckedCreateInput {
  return {
    clientId: b.clientId ?? null,
    vin: nn(b.vin),
    immatriculation: b.immatriculation.replace(/\s/g, "-"),
    marque: b.marque,
    modele: b.modele,
    annee: b.annee,
    motorisation: nn(b.motorisation),
    kilometrage: b.kilometrage ?? null,
    prochainCT: b.prochainCT ? new Date(`${b.prochainCT}T12:00:00Z`) : null,
  };
}

/** Plaque saisie sans tirets ni espaces (« ab123cd ») : comparaison sur la plaque normalisée, requête paramétrée. */
export async function idsVehiculesParPlaque(q: string): Promise<string[]> {
  const compact = q.replace(/[\s-]/g, "").replace(/[%_\\]/g, "");
  if (compact.length < 2) return [];
  const r = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Vehicule" WHERE REPLACE(REPLACE(immatriculation, '-', ''), ' ', '') ILIKE ${`%${compact}%`} LIMIT 50`;
  return r.map((x) => x.id);
}

/** Recherche par plaque, VIN, marque, modèle ou nom du client propriétaire. */
export async function rechercherVehicules(opts: { q?: string; clientId?: string; take?: number }) {
  const q = opts.q?.trim();
  const parPlaque = q ? await idsVehiculesParPlaque(q) : [];
  const where: Prisma.VehiculeWhereInput = {
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
    ...(q
      ? {
          OR: [
            { immatriculation: { contains: q, mode: "insensitive" } },
            { id: { in: parPlaque } },
            { vin: { contains: q, mode: "insensitive" } },
            { marque: { contains: q, mode: "insensitive" } },
            { modele: { contains: q, mode: "insensitive" } },
            { client: { OR: [{ lastName: { contains: q, mode: "insensitive" } }, { firstName: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }] } },
          ],
        }
      : {}),
  };
  const items = await db.vehicule.findMany({
    where,
    orderBy: { immatriculation: "asc" },
    take: opts.take ?? 50,
    include: { client: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, discountRate: true } } },
  });
  return items.map((v) => ({
    id: v.id,
    clientId: v.clientId,
    immatriculation: v.immatriculation,
    marque: v.marque,
    modele: v.modele,
    annee: v.annee,
    motorisation: v.motorisation,
    vin: v.vin,
    kilometrage: v.kilometrage,
    prochainCT: v.prochainCT ? v.prochainCT.toISOString().slice(0, 10) : null,
    client: v.client ? { ...v.client, discountRate: Number(v.client.discountRate) } : null,
  }));
}
