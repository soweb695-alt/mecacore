import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, UserX } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";
import { VehiculeForm } from "@/components/clients/vehicule-form";
import { ConfirmButton } from "@/components/confirm-button";
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

export const metadata: Metadata = { title: "Fiche client" };

const MODELES: Record<string, string> = {
  devis: "Devis",
  bon_livraison: "Bon de livraison",
  campagne: "Campagne promotionnelle",
  recap_impayes: "Récapitulatif des impayés",
  rdv_rappel_j1: "Rappel de rendez-vous (J-1)",
  rdv_rappel_j7: "Rappel de rendez-vous (J-7)",
};
const STATUTS_MESSAGE: Record<string, string> = { EN_COURS: "en cours", ECHEC: "échec", IGNORE: "non envoyé : service non configuré", ENVOYE: "envoyé" };

export default async function FicheClient({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("read", "client");
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      vehicules: { orderBy: { immatriculation: "asc" } },
      devis: { orderBy: { dateCreation: "desc" }, take: 8, select: { id: true, numero: true, statut: true, totalTTC: true, dateCreation: true } },
      factures: { orderBy: { dateEmission: "desc" }, take: 8, select: { id: true, numero: true, statut: true, totalTTC: true, dateEmission: true } },
      messages: { orderBy: { envoyeLe: "desc" }, take: 10 },
    },
  });
  if (!client) notFound();

  const nom = nomClient(client);
  const anonymise = !!client.anonymiseLe;
  const retours = can(user, "read", "retour") ? await db.retourPiece.count({ where: { clientId: client.id } }) : null;

  return (
    <>
      <PageHeader
        title={nom}
        description={`${client.type === "PRO" ? "Professionnel" : "Particulier"} · client depuis le ${dateFR(client.createdAt)}${anonymise ? " · anonymisé" : ""}`}
        actions={
          !anonymise && (
            <>
              {can(user, "update", "client") && (
                <FormDialog
                  title="Modifier le client"
                  trigger={
                    <Button variant="outline">
                      <Pencil aria-hidden />
                      Modifier
                    </Button>
                  }
                >
                  {(
                    <ClientForm
                     
                      client={{
                        id: client.id,
                        type: client.type,
                        firstName: client.firstName ?? "",
                        lastName: client.lastName ?? "",
                        companyName: client.companyName ?? "",
                        siret: client.siret ?? "",
                        tvaNumber: client.tvaNumber ?? "",
                        email: client.email ?? "",
                        phone: client.phone ?? "",
                        address: client.address ?? "",
                        paymentTerms: client.paymentTerms,
                        creditLimit: Number(client.creditLimit),
                        discountRate: Number(client.discountRate),
                        marketingOptIn: client.marketingOptIn,
                      }}
                    />
                  )}
                </FormDialog>
              )}
              {retours !== null && retours > 0 && (
                <Link href={`/retours?clientId=${client.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                  Retours & consignées ({retours})
                </Link>
              )}
              {can(user, "create", "devis") && (
                <Link href={`/devis/nouveau?clientId=${client.id}`} className={cn(buttonVariants())}>
                  <Plus aria-hidden />
                  Nouveau devis
                </Link>
              )}
            </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Véhicules</CardTitle>
              {!anonymise && can(user, "create", "vehicule") && (
                <FormDialog
                  title="Ajouter un véhicule"
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus aria-hidden />
                      Ajouter
                    </Button>
                  }
                >
                  {<VehiculeForm clientId={client.id} clientNom={nom} />}
                </FormDialog>
              )}
            </CardHeader>
            <CardContent>
              {client.vehicules.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Aucun véhicule enregistré pour ce client.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plaque</TableHead>
                      <TableHead>Véhicule</TableHead>
                      <TableHead>Motorisation</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.vehicules.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium"><Link href={`/vehicules/${v.id}`} className="hover:underline">{v.immatriculation}</Link></TableCell>
                        <TableCell>
                          {v.marque} {v.modele}
                          {v.annee ? ` (${v.annee})` : ""}
                        </TableCell>
                        <TableCell>{v.motorisation ?? "–"}</TableCell>
                        <TableCell>
                          {can(user, "update", "vehicule") && (
                            <FormDialog
                              title="Modifier le véhicule"
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${v.immatriculation}`}>
                                  <Pencil aria-hidden />
                                </Button>
                              }
                            >
                              {<VehiculeForm clientId={client.id} clientNom={nom} vehicule={{ ...v, vin: v.vin ?? "", motorisation: v.motorisation ?? "", prochainCT: v.prochainCT ? v.prochainCT.toISOString().slice(0, 10) : "" }} />}
                            </FormDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {can(user, "read", "devis") && (
            <Card>
              <CardHeader>
                <CardTitle>Devis et factures</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {client.devis.length + client.factures.length === 0 && <p className="py-2 text-sm text-muted-foreground">Aucun document pour le moment.</p>}
                {client.devis.map((d) => (
                  <Link key={d.id} href={`/devis/${d.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/50">
                    <span>
                      <span className="font-medium">{d.numero}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{dateFR(d.dateCreation)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge tone={TONE_DEVIS[d.statut]}>{LABELS.statutDevis[d.statut]}</StatusBadge>
                      <span className="w-24 text-right tabular-nums">{eur(d.totalTTC.toString())}</span>
                    </span>
                  </Link>
                ))}
                {can(user, "read", "facture") &&
                  client.factures.map((f) => (
                    <Link key={f.id} href={`/factures/${f.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/50">
                      <span>
                        <span className="font-medium">{f.numero ?? "Brouillon"}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{dateFR(f.dateEmission)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <StatusBadge tone={TONE_FACTURE[f.statut]}>{LABELS.statutFacture[f.statut]}</StatusBadge>
                        <span className="w-24 text-right tabular-nums">{eur(f.totalTTC.toString())}</span>
                      </span>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="E-mail" value={client.email} />
              <Info label="Téléphone" value={client.phone} />
              <Info label="Adresse" value={client.address} />
              {client.type === "PRO" && (
                <>
                  <Info label="SIRET" value={client.siret} />
                  <Info label="N° de TVA" value={client.tvaNumber} />
                  <Info label="Remise pièces" value={`${Number(client.discountRate)} %`} />
                </>
              )}
              <Info label="Délai de paiement" value={`${client.paymentTerms} jours`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Consentement RGPD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusBadge tone={client.marketingOptIn ? "ok" : "neutral"}>
                {client.marketingOptIn ? "Accepte les communications marketing" : "N'a pas consenti au marketing"}
              </StatusBadge>
              {!anonymise && can(user, "delete", "client") && (
                <div>
                  <ConfirmButton
                    label="Anonymiser ce client"
                    title="Anonymiser ce client ?"
                    description="Ses données personnelles seront effacées définitivement. Ses factures sont conservées conformément à l'obligation légale de 10 ans. Cette action est irréversible."
                    url={`/api/clients/${client.id}/anonymiser`}
                    success="Client anonymisé"
                  >
                    <UserX aria-hidden />
                  </ConfirmButton>
                </div>
              )}
            </CardContent>
          </Card>
          {client.messages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Derniers messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {client.messages.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span>
                      {m.canal === "SMS" ? "SMS" : "E-mail"} · {MODELES[m.template] ?? m.template}
                      {m.statut !== "ENVOYE" && <span className="ml-1.5 text-xs text-warning">({STATUTS_MESSAGE[m.statut]})</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateFR(m.envoyeLe)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value || "–"}</div>
    </div>
  );
}
