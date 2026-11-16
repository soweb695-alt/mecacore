import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { VehiculeForm } from "@/components/clients/vehicule-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { HistoriqueDevisTable, HistoriqueFacturesTable } from "@/components/clients/fiches-columns";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { dateFR, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Fiche véhicule" };

export default async function FicheVehicule({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("read", "vehicule");
  const { id } = await params;
  const v = await db.vehicule.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true } },
      devis: {
        orderBy: { dateCreation: "desc" },
        select: { id: true, numero: true, type: true, statut: true, totalTTC: true, dateCreation: true, kilometrage: true, facture: { select: { id: true, numero: true, statut: true, totalTTC: true, dateEmission: true } } },
      },
    },
  });
  if (!v) notFound();
  const factures = v.devis.flatMap((d) => (d.facture ? [d.facture] : []));
  const voirDevis = can(user, "read", "devis");
  const voirFactures = can(user, "read", "facture");

  return (
    <>
      <PageHeader
        title={`${v.marque} ${v.modele} · ${v.immatriculation}`}
        description={[v.annee, v.motorisation, v.vin ? `VIN ${v.vin}` : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {can(user, "update", "vehicule") && (
              <FormDialog
                title="Modifier le véhicule"
                wide
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden />
                    Modifier
                  </Button>
                }
              >
                <VehiculeForm
                  clientNom={v.client ? nomClient(v.client) : undefined}
                  vehicule={{
                    id: v.id,
                    clientId: v.clientId,
                    immatriculation: v.immatriculation,
                    marque: v.marque,
                    modele: v.modele,
                    annee: v.annee,
                    vin: v.vin ?? "",
                    motorisation: v.motorisation ?? "",
                    kilometrage: v.kilometrage,
                    prochainCT: v.prochainCT ? v.prochainCT.toISOString().slice(0, 10) : "",
                  }}
                />
              </FormDialog>
            )}
            {can(user, "create", "devis") && v.clientId && (
              <Link href={`/devis/nouveau?clientId=${v.clientId}&vehiculeId=${v.id}`} className={cn(buttonVariants())}>
                <Plus aria-hidden />
                Nouveau devis
              </Link>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 text-sm">
            <div className="text-xs text-muted-foreground">Client associé</div>
            {v.client ? (
              <Link href={`/clients/${v.client.id}`} className="text-base font-medium hover:underline">
                {nomClient(v.client)}
              </Link>
            ) : (
              <div className="text-base">Aucun — associez-en un via « Modifier »</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-sm">
            <div className="text-xs text-muted-foreground">Kilométrage</div>
            <div className="text-base font-medium tabular-nums">{v.kilometrage != null ? `${v.kilometrage.toLocaleString("fr-FR")} km` : "–"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-sm">
            <div className="text-xs text-muted-foreground">Prochain contrôle technique</div>
            <div className="text-base font-medium">{v.prochainCT ? dateFR(v.prochainCT) : "–"}</div>
          </CardContent>
        </Card>
      </div>

      {voirDevis && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Historique · devis ({v.devis.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoriqueDevisTable rows={v.devis.map((d) => ({ id: d.id, numero: d.numero, date: d.dateCreation.toISOString(), kilometrage: d.kilometrage, statut: d.statut, totalTTC: Number(d.totalTTC) }))} />
          </CardContent>
        </Card>
      )}

      {voirFactures && (
        <Card>
          <CardHeader>
            <CardTitle>Historique · factures ({factures.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoriqueFacturesTable rows={factures.map((f) => ({ id: f.id, numero: f.numero, emission: f.dateEmission.toISOString(), statut: f.statut, totalTTC: Number(f.totalTTC) }))} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
