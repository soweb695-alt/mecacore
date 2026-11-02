import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { idsVehiculesParPlaque } from "@/lib/services/vehicules";
import { nn } from "@/lib/validators/common";
import type { ClientInput } from "@/lib/validators/client";

export const PAGE_SIZE = 20;

export function clientData(b: ClientInput): Prisma.ClientCreateInput {
  return {
    type: b.type,
    firstName: nn(b.firstName),
    lastName: nn(b.lastName),
    companyName: nn(b.companyName),
    siret: nn(b.siret)?.replace(/\s/g, "") ?? null,
    tvaNumber: nn(b.tvaNumber),
    email: nn(b.email),
    phone: nn(b.phone),
    address: nn(b.address),
    paymentTerms: b.paymentTerms,
    creditLimit: b.creditLimit,
    discountRate: b.type === "PRO" ? b.discountRate : 0,
    marketingOptIn: b.marketingOptIn,
  };
}

export async function rechercherClients(opts: { q?: string; type?: "PARTICULIER" | "PRO"; page: number }) {
  const q = opts.q?.trim();
  const plaques = q ? await idsVehiculesParPlaque(q) : [];
  const where: Prisma.ClientWhereInput = {
    isActive: true,
    anonymiseLe: null,
    ...(opts.type ? { type: opts.type } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\s/g, "") } },
            { phone: { contains: q } },
            { vehicules: { some: { OR: [{ immatriculation: { contains: q, mode: "insensitive" } }, { id: { in: plaques } }] } } },
          ],
        }
      : {}),
  };
  const [total, items, pros] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { companyName: "asc" }],
      skip: (opts.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { vehicules: true } } },
    }),
    db.client.count({ where: { isActive: true, anonymiseLe: null, type: "PRO" } }),
  ]);
  const ca = await db.facture.groupBy({
    by: ["clientId"],
    where: { clientId: { in: items.map((c) => c.id) }, statut: { notIn: ["ANNULEE", "BROUILLON"] } },
    _sum: { totalTTC: true },
  });
  const caParClient = new Map(ca.map((r) => [r.clientId, Number(r._sum.totalTTC ?? 0)]));
  return {
    total,
    pros,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: items.map((c) => ({ ...c, creditLimit: Number(c.creditLimit), discountRate: Number(c.discountRate), ca: caParClient.get(c.id) ?? 0 })),
  };
}
