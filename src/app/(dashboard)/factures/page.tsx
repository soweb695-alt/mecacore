import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { FacturesTable } from "@/components/factures/factures-table";
import { LABELS } from "@/components/status-badge";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Prisma } from "@/generated/prisma/client";
import { filtreClient } from "@/lib/client-search";
import { db } from "@/lib/db";
import { dateFR, eur, nomClient } from "@/lib/format";
import { rafraichirStatuts } from "@/lib/services/factures";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { cn } from "@/lib/utils";
import { factureListQuery } from "@/lib/validators/facture";

export const metadata: Metadata = { title: "Factures" };
const TAILLE = 20;

export default async function FacturesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "facture");
  const sp = await searchParams;
  const parsed = factureListQuery.safeParse({ q: sp.q || undefined, statut: sp.statut || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  await rafraichirStatuts();
  const where: Prisma.FactureWhereInput = {
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.q ? { OR: [{ numero: { contains: query.q, mode: "insensitive" } }, { client: filtreClient(query.q) }] } : {}),
  };
  const [total, items, impayes] = await Promise.all([
    db.facture.count({ where }),
    db.facture.findMany({ where, orderBy: [{ statut: "asc" }, { dateEmission: "desc" }], skip: (query.page - 1) * TAILLE, take: TAILLE, include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } } } }),
    db.facture.findMany({ where: { statut: "IMPAYEE" }, select: { totalTTC: true, montantPaye: true } }),
  ]);
  const totalImpaye = impayes.reduce((s, f) => s + Number(f.totalTTC) - Number(f.montantPaye), 0);

  return (
    <>
      <PageHeader
        title="Factures"
        description={`${total} facture${total > 1 ? "s" : ""} · impayés : ${eur(totalImpaye)} (${impayes.length})`}
        actions={
          can(user, "create", "facture") && (
            <Link href="/factures/nouvelle" className={cn(buttonVariants())}>
              <Plus aria-hidden />
              Nouvelle facture
            </Link>
          )
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2.5">
        <Input name="q" defaultValue={sp.q} placeholder="N° de facture, client…" aria-label="Rechercher une facture" className="w-80" maxLength={100} />
        <NativeSelect name="statut" defaultValue={sp.statut ?? ""} aria-label="Statut" className="w-52">
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.statutFacture).map(([k, v]) => (
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
        <FacturesTable
          peutExporter={can(user, "export", "facture")}
          rows={items.map((f) => ({
            id: f.id,
            numero: f.numero,
            client: nomClient(f.client),
            emission: f.statut === "BROUILLON" ? "–" : dateFR(f.dateEmission),
            echeance: dateFR(f.dateEcheance),
            statut: f.statut,
            totalTTC: eur(f.totalTTC.toString()),
            reste: f.statut === "ANNULEE" || f.statut === "BROUILLON" ? null : eur(Number(f.totalTTC) - Number(f.montantPaye)),
          }))}
        />
      </Card>
      <Pagination page={query.page} pages={Math.max(1, Math.ceil(total / TAILLE))} basePath="/factures" params={{ q: sp.q, statut: sp.statut }} />
    </>
  );
}
