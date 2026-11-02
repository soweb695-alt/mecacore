import type { Prisma } from "@/generated/prisma/client";

/**
 * Filtre « client » d'une recherche libre : prénom, nom, raison sociale, et « Prénom Nom » / « Nom Prénom »
 * quand la saisie contient plusieurs mots.
 */
export function filtreClient(q: string): Prisma.ClientWhereInput {
  const contient = (v: string) => ({ contains: v, mode: "insensitive" as const });
  const mots = q.split(/\s+/).filter(Boolean);
  const ou: Prisma.ClientWhereInput[] = [{ firstName: contient(q) }, { lastName: contient(q) }, { companyName: contient(q) }];
  if (mots.length >= 2) {
    const [a, ...reste] = mots;
    const b = reste.join(" ");
    ou.push({ AND: [{ firstName: contient(a) }, { lastName: contient(b) }] }, { AND: [{ lastName: contient(a) }, { firstName: contient(b) }] });
  }
  return { OR: ou };
}
