import type { Metadata } from "next";
import Link from "next/link";
import { Car, ChevronRight } from "lucide-react";
import { VehiculeForm } from "@/components/clients/vehicule-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateFR, nomClient } from "@/lib/format";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plaque</TableHead>
              <TableHead>Véhicule</TableHead>
              <TableHead>Kilométrage</TableHead>
              <TableHead>Prochain CT</TableHead>
              <TableHead>Client associé</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Aucun véhicule trouvé.
                </TableCell>
              </TableRow>
            )}
            {items.map((v) => (
              <TableRow key={v.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">
                  <Link href={`/vehicules/${v.id}`} className="hover:underline">
                    {v.immatriculation}
                  </Link>
                </TableCell>
                <TableCell>
                  {v.marque} {v.modele} {v.annee ? `(${v.annee})` : ""}
                  {v.motorisation && <div className="text-xs text-muted-foreground">{v.motorisation}</div>}
                </TableCell>
                <TableCell className="tabular-nums">{v.kilometrage != null ? `${v.kilometrage.toLocaleString("fr-FR")} km` : "–"}</TableCell>
                <TableCell>{v.prochainCT ? dateFR(v.prochainCT) : "–"}</TableCell>
                <TableCell>
                  {v.client ? (
                    <Link href={`/clients/${v.client.id}`} className="hover:underline">
                      {nomClient(v.client)}
                    </Link>
                  ) : (
                    <StatusBadge>Sans client</StatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/vehicules/${v.id}`} aria-label={`Ouvrir ${v.immatriculation}`}>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
