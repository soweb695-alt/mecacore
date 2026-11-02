import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { VehiculeForm } from "@/components/clients/vehicule-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_DEVIS, TONE_FACTURE } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateFR, eur, nomClient } from "@/lib/format";
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Kilométrage</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.devis.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      Aucun devis pour ce véhicule.
                    </TableCell>
                  </TableRow>
                )}
                {v.devis.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link href={`/devis/${d.id}`} className="hover:underline">
                        {d.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{dateFR(d.dateCreation)}</TableCell>
                    <TableCell className="tabular-nums">{d.kilometrage != null ? `${d.kilometrage.toLocaleString("fr-FR")} km` : "–"}</TableCell>
                    <TableCell>
                      <StatusBadge tone={TONE_DEVIS[d.statut]}>{LABELS.statutDevis[d.statut]}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{eur(d.totalTTC.toString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {voirFactures && (
        <Card>
          <CardHeader>
            <CardTitle>Historique · factures ({factures.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Aucune facture pour ce véhicule.
                    </TableCell>
                  </TableRow>
                )}
                {factures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link href={`/factures/${f.id}`} className="hover:underline">
                        {f.numero ?? "Brouillon"}
                      </Link>
                    </TableCell>
                    <TableCell>{dateFR(f.dateEmission)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={TONE_FACTURE[f.statut]}>{LABELS.statutFacture[f.statut]}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f.totalTTC.toString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
