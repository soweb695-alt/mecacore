import type { Metadata } from "next";
import { Car } from "lucide-react";
import { VehiculeForm } from "@/components/clients/vehicule-form";
import { VehiculesTable } from "@/components/clients/vehicules-columns";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { rechercherVehicules } from "@/lib/services/vehicules";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Véhicules" };

export default async function VehiculesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "vehicule");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60);
  const items = await rechercherVehicules({ q, take: 100 });
  return (
    <>
      <PageHeader
        title="Véhicules"
        description="Le véhicule est créé d'abord, puis associé à un client. Cliquez sur un véhicule pour voir ses devis et factures."
        actions={
          can(user, "create", "vehicule") && (
            <FormDialog
              title="Nouveau véhicule"
              wide
              trigger={
                <Button>
                  <Car aria-hidden />
                  Nouveau véhicule
                </Button>
              }
            >
              <VehiculeForm />
            </FormDialog>
          )
        }
      />
      <form method="get" className="mb-4 flex gap-2.5">
        <Input name="q" defaultValue={q} placeholder="Plaque, VIN, marque, modèle, client…" aria-label="Rechercher un véhicule" className="w-96" maxLength={60} />
        <Button type="submit" variant="outline">
          Rechercher
        </Button>
      </form>
      <Card className="p-2">
        <VehiculesTable
          rows={items.map((v) => ({
            id: v.id,
            immatriculation: v.immatriculation,
            vehicule: `${v.marque} ${v.modele}${v.annee ? ` (${v.annee})` : ""}`,
            motorisation: v.motorisation,
            kilometrage: v.kilometrage,
            prochainCT: v.prochainCT ? String(v.prochainCT) : null,
            client: v.client ? { id: v.client.id, nom: nomClient(v.client) } : null,
          }))}
        />
      </Card>
    </>
  );
}
