import type { Metadata } from "next";
import { Upload, UserPlus } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { ClientsTable } from "@/components/clients/clients-table";
import { ImportClients } from "@/components/clients/import-clients";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Prisma } from "@/generated/prisma/client";
import { nomClient } from "@/lib/format";
import { rechercherClients } from "@/lib/services/clients";
import { requirePage } from "@/lib/session";
import { clientListQuery } from "@/lib/validators/client";
import { can } from "@/lib/permissions";
import { lireTri } from "@/lib/tri";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "client");
  const sp = await searchParams;
  const parsed = clientListQuery.safeParse({ q: sp.q || undefined, type: sp.type || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const tri = lireTri<Prisma.ClientOrderByWithRelationInput[]>(
    sp,
    { nom: (o) => [{ lastName: o }, { companyName: o }, { firstName: o }], type: (o) => [{ type: o }, { lastName: "asc" }], marketing: (o) => [{ marketingOptIn: o }, { lastName: "asc" }] },
    [{ lastName: "asc" }, { companyName: "asc" }],
  );
  const res = await rechercherClients({ ...query, orderBy: tri.orderBy });

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${res.total} client${res.total > 1 ? "s" : ""} · ${res.pros} professionnel${res.pros > 1 ? "s" : ""}`}
        actions={
          <>
          {user.role === "ADMIN" && (
            <FormDialog
              title="Importer des clients"
              description="Depuis l'export « Clients » de Pennylane, ou un fichier Excel / CSV."
              wide
              trigger={
                <Button variant="outline">
                  <Upload aria-hidden />
                  Importer
                </Button>
              }
            >
              <ImportClients />
            </FormDialog>
          )}
          {can(user, "create", "client") && (
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
          )}
          </>
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
        <ClientsTable
          serveur={{ page: query.page, pages: res.pages, total: res.total, tri: tri.tri, ordre: tri.ordre }}
          rows={res.items.map((c) => ({
            id: c.id,
            nom: nomClient(c),
            detail: c.type === "PRO" && c.siret ? `SIRET ${c.siret}` : c.email,
            type: c.type,
            telephone: c.phone,
            vehicules: c._count.vehicules,
            ca: c.ca,
            marketing: c.marketingOptIn,
          }))}
        />
      </Card>
    </>
  );
}
