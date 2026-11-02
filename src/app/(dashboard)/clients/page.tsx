import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, UserPlus } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eur, nomClient } from "@/lib/format";
import { rechercherClients } from "@/lib/services/clients";
import { requirePage } from "@/lib/session";
import { clientListQuery } from "@/lib/validators/client";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "client");
  const sp = await searchParams;
  const parsed = clientListQuery.safeParse({ q: sp.q || undefined, type: sp.type || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const res = await rechercherClients(query);

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${res.total} client${res.total > 1 ? "s" : ""} · ${res.pros} professionnel${res.pros > 1 ? "s" : ""}`}
        actions={
          can(user, "create", "client") && (
            <FormDialog
              title="Nouveau client"
              trigger={
                <Button>
                  <UserPlus aria-hidden />
                  Nouveau client
                </Button>
              }
            >
              <ClientForm />
            </FormDialog>
          )
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2.5">
        <Input name="q" defaultValue={sp.q} placeholder="Nom, société, téléphone, plaque…" aria-label="Rechercher un client" className="w-80" maxLength={100} />
        <NativeSelect name="type" defaultValue={sp.type ?? ""} aria-label="Type de client" className="w-44">
          <option value="">Tous les types</option>
          <option value="PARTICULIER">Particuliers</option>
          <option value="PRO">Professionnels</option>
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Véhicules</TableHead>
              <TableHead className="text-right">CA cumulé</TableHead>
              <TableHead>Marketing</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aucun client ne correspond à votre recherche.
                </TableCell>
              </TableRow>
            )}
            {res.items.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/40">
                <TableCell>
                  <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                    {nomClient(c)}
                  </Link>
                  <div className="text-xs text-muted-foreground">{c.type === "PRO" && c.siret ? `SIRET ${c.siret}` : c.email}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={c.type === "PRO" ? "info" : "neutral"}>{c.type === "PRO" ? "Pro" : "Particulier"}</StatusBadge>
                </TableCell>
                <TableCell>{c.phone ?? "–"}</TableCell>
                <TableCell>{c._count.vehicules}</TableCell>
                <TableCell className="text-right tabular-nums">{eur(c.ca)}</TableCell>
                <TableCell>
                  <StatusBadge tone={c.marketingOptIn ? "ok" : "neutral"}>{c.marketingOptIn ? "Opt-in" : "Non"}</StatusBadge>
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${c.id}`} aria-label={`Ouvrir la fiche de ${nomClient(c)}`}>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={query.page} pages={res.pages} basePath="/clients" params={{ q: sp.q, type: sp.type }} />
    </>
  );
}
