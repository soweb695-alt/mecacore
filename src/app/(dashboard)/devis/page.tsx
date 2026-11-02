import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { LABELS, StatusBadge, TONE_DEVIS } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { filtreClient } from "@/lib/client-search";
import { db } from "@/lib/db";
import { dateFR, eur, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
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
  const [total, items] = await Promise.all([
    db.devis.count({ where }),
    db.devis.findMany({
      where,
      orderBy: { dateCreation: "desc" },
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Véhicule</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total TTC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Aucun devis. Créez votre premier devis.
                </TableCell>
              </TableRow>
            )}
            {items.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">
                  <Link href={`/devis/${d.id}`} className="hover:underline">
                    {d.numero}
                  </Link>
                </TableCell>
                <TableCell>{nomClient(d.client)}</TableCell>
                <TableCell>{d.vehicule ? `${d.vehicule.marque} ${d.vehicule.modele} · ${d.vehicule.immatriculation}` : "Vente de pièces"}</TableCell>
                <TableCell>{dateFR(d.dateCreation)}</TableCell>
                <TableCell>
                  <StatusBadge tone={TONE_DEVIS[d.statut]}>{LABELS.statutDevis[d.statut]}</StatusBadge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{eur(d.totalTTC.toString())}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={query.page} pages={Math.max(1, Math.ceil(total / TAILLE))} basePath="/devis" params={{ q: sp.q, statut: sp.statut }} />
    </>
  );
}
