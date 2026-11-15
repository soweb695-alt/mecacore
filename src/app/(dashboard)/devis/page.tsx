import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DevisTable } from "@/components/devis/devis-table";
import { LABELS } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Prisma } from "@/generated/prisma/client";
import { filtreClient } from "@/lib/client-search";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { lireTri } from "@/lib/tri";
import { cn } from "@/lib/utils";
import { devisListQuery } from "@/lib/validators/devis";

export const metadata: Metadata = { title: "Devis" };
const TAILLE = 20;

export default async function DevisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "devis");
  const sp = await searchParams;
  const parsed = devisListQuery.safeParse({ q: sp.q || undefined, statut: sp.statut || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const where: Prisma.DevisWhereInput = {
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.q
      ? {
          OR: [
            { numero: { contains: query.q, mode: "insensitive" } },
            { client: filtreClient(query.q) },
            { vehicule: { immatriculation: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const tri = lireTri<Prisma.DevisOrderByWithRelationInput[]>(
    sp,
    {
      numero: (o) => [{ numero: o }],
      client: (o) => [{ client: { lastName: o } }, { client: { companyName: o } }],
      date: (o) => [{ dateCreation: o }],
      statut: (o) => [{ statut: o }, { dateCreation: "desc" }],
      totalTTC: (o) => [{ totalTTC: o }],
    },
    [{ dateCreation: "desc" }],
  );
  const [total, items] = await Promise.all([
    db.devis.count({ where }),
    db.devis.findMany({
      where,
      orderBy: tri.orderBy,
      skip: (query.page - 1) * TAILLE,
      take: TAILLE,
      include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } }, vehicule: { select: { immatriculation: true, marque: true, modele: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Devis"
        description={`${total} devis`}
        actions={
          can(user, "create", "devis") && (
            <Link href="/devis/nouveau" className={cn(buttonVariants())}>
              <Plus aria-hidden />
              Nouveau devis
            </Link>
          )
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2.5">
        <Input name="q" defaultValue={sp.q} placeholder="N° de devis, prénom, nom, plaque…" aria-label="Rechercher un devis" className="w-80" maxLength={100} />
        <NativeSelect name="statut" defaultValue={sp.statut ?? ""} aria-label="Statut" className="w-44">
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.statutDevis).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
      <Card className="p-2">
        <DevisTable
          serveur={{ page: query.page, pages: Math.max(1, Math.ceil(total / TAILLE)), total, tri: tri.tri, ordre: tri.ordre }}
          rows={items.map((d) => ({
            id: d.id,
            numero: d.numero,
            client: nomClient(d.client),
            vehicule: d.vehicule ? `${d.vehicule.marque} ${d.vehicule.modele} · ${d.vehicule.immatriculation}` : null,
            date: d.dateCreation.toISOString(),
            statut: d.statut,
            totalTTC: Number(d.totalTTC),
          }))}
        />
      </Card>
    </>
  );
}
