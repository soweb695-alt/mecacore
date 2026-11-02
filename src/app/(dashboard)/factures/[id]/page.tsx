import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CreditCard, FileDown, Send } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FactureForm } from "@/components/factures/facture-form";
import { ModePaiementSelect } from "@/components/factures/mode-paiement-select";
import { PaiementForm } from "@/components/factures/paiement-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_FACTURE } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateFR, eur, nomClient } from "@/lib/format";
import { lireComposition, libelleComposition } from "@/lib/composition";
import { round2 } from "@/lib/money";
import { can, canSeeMargins } from "@/lib/permissions";
import { rafraichirStatuts } from "@/lib/services/factures";
import { montantRemise, tauxRemiseLigne } from "@/lib/remise";
import { requirePage } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Facture" };

export default async function FactureDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("read", "facture");
  const { id } = await params;
  await rafraichirStatuts();
  const f = await db.facture.findUnique({
    where: { id },
    include: { client: true, lignes: { orderBy: { position: "asc" } }, paiements: { orderBy: { datePaiement: "asc" } }, devis: { select: { id: true, numero: true, ordre: { select: { id: true, numero: true } } } }, bonsLivraison: { select: { id: true, numero: true }, orderBy: { numero: "asc" } } },
  });
  if (!f) notFound();

  // Brouillon préparé à la fin d'un OR : le Magasin ajuste les lignes puis émet la facture (numéro attribué à l'émission).
  if (f.statut === "BROUILLON") {
    const pieces = await db.piece.findMany({ where: { id: { in: f.lignes.flatMap((l) => (l.pieceId ? [l.pieceId] : [])) } }, select: { id: true, stock: true } });
    const stock = new Map(pieces.map((p) => [p.id, p.stock]));
    const remisePct = f.client.type === "PRO" ? Number(f.client.discountRate) : 0;
    return (
      <>
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              Facture à émettre
              <StatusBadge tone={TONE_FACTURE[f.statut]}>{LABELS.statutFacture[f.statut]}</StatusBadge>
            </span>
          }
          description={
            <>
              {nomClient(f.client)}
              {f.devis?.ordre && (
                <>
                  {" "}· préparée à la fin de{" "}
                  <Link href={`/ordres-reparation/${f.devis.ordre.id}`} className="hover:underline">
                    {f.devis.ordre.numero}
                  </Link>
                </>
              )}
              {f.kilometrage != null && <> · {f.kilometrage.toLocaleString("fr-FR")} km</>} · le numéro est attribué à l&apos;émission
            </>
          }
          actions={
            <a href={`/api/factures/${f.id}/pdf`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }))}>
              <FileDown aria-hidden />
              Aperçu PDF
            </a>
          }
        />
        {can(user, "update", "facture") ? (
          <FactureForm
            echeanceParDefaut={f.dateEcheance.toISOString().slice(0, 10)}
            brouillon={{
              id: f.id,
              client: { id: f.clientId, nom: nomClient(f.client), pro: f.client.type === "PRO", remisePct },
              options: {
                valeur: Number(f.remiseGlobaleValeur) > 0 ? String(Number(f.remiseGlobaleValeur)) : "",
                type: f.remiseGlobaleType ?? "POURCENT",
                base: f.remiseGlobaleBase ?? "HT",
                mode: f.modePaiement ?? "",
              },
              lignes: f.lignes.map((l) => ({
                id: l.id,
                type: l.type,
                designation: l.designation,
                quantite: String(Number(l.quantite)),
                prixUnitaireHT: String(Number(l.prixUnitaireHT)),
                tvaRate: String(Number(l.tvaRate)),
                pieceId: l.pieceId,
                stock: l.pieceId ? (stock.get(l.pieceId) ?? null) : null,
                prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null,
                composition: libelleComposition(lireComposition(l.composition)),
              })),
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Cette facture n&apos;est pas encore émise.</p>
        )}
      </>
    );
  }
  const banque = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { iban: true, bic: true } });
  const iban = !!banque?.iban && !!banque.bic;
  const marges = canSeeMargins(user);
  const total = Number(f.totalTTC);
  const paye = Number(f.montantPaye);
  const reste = round2(total - paye);
  const pct = total > 0 ? Math.min(100, Math.round((paye / total) * 100)) : 0;
  const peutPayer = can(user, "create", "paiement") && f.statut !== "ANNULEE" && reste > 0;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {f.numero}
            <StatusBadge tone={TONE_FACTURE[f.statut]}>{LABELS.statutFacture[f.statut]}</StatusBadge>
          </span>
        }
        description={
          <>
            <Link href={`/clients/${f.clientId}`} className="hover:underline">
              {nomClient(f.client)}
            </Link>{" "}
            · {f.devis ? (
              <>
                depuis{" "}
                <Link href={`/devis/${f.devis.id}`} className="hover:underline">
                  {f.devis.numero}
                </Link>
              </>
            ) : f.bonsLivraison.length > 0 ? (
              <>regroupe {f.bonsLivraison.map((b) => b.numero).join(", ")}</>
            ) : (
              <>saisie manuelle</>
            )}{" "}
            · émise le {dateFR(f.dateEmission)} · échéance le {dateFR(f.dateEcheance)}
          </>
        }
        actions={
          <>
            <a href={`/api/factures/${f.id}/pdf`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }))}>
              <FileDown aria-hidden />
              PDF
            </a>
            {can(user, "delete", "facture") && f.statut !== "ANNULEE" && paye === 0 && (
              <ConfirmButton label="Annuler la facture" title="Annuler cette facture ?" description="La facture passera au statut Annulée. Cette action est définitive." url={`/api/factures/${f.id}/annuler`} method="POST" success="Facture annulée" variant="outline" size="default">
                <Ban aria-hidden />
              </ConfirmButton>
            )}
            {peutPayer && (
              <FormDialog
                title="Enregistrer un paiement"
                trigger={
                  <Button>
                    <CreditCard aria-hidden />
                    Enregistrer un paiement
                  </Button>
                }
              >
                <PaiementForm factureId={f.id} reste={reste} />
              </FormDialog>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lignes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">PU HT</TableHead>
                  <TableHead className="text-right">TVA</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                  {marges && <TableHead className="text-right">Marge</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.lignes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.designation}
                      {l.prixCatalogueHT !== null && tauxRemiseLigne({ prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: Number(l.prixCatalogueHT) }) > 0 && (
                        <div className="text-xs text-success">
                          Catalogue {eur(l.prixCatalogueHT.toString())} · remise pro {tauxRemiseLigne({ prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: Number(l.prixCatalogueHT) })} %
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(l.quantite)}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(l.prixUnitaireHT.toString())}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(l.tvaRate)} %</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(l.totalHT.toString())}</TableCell>
                    {marges && <TableCell className="text-right tabular-nums text-muted-foreground">{l.prixAchatHT ? eur(round2((Number(l.prixUnitaireHT) - Number(l.prixAchatHT)) * Number(l.quantite))) : "–"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="ml-auto mt-4 w-72 space-y-1.5 text-sm">
              {Number(f.remisePro) > 0 && (
                <p className="text-xs text-success">
                  Remise professionnelle de {Number(f.remisePro)} % déduite sur les pièces ({eur(montantRemise(f.lignes.map((l) => ({ quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null }))))} HT).
                </p>
              )}
              {f.totalHTAvantRemise !== null && Number(f.remiseGlobaleMontant) > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total HT avant remise</span><span className="tabular-nums">{eur(f.totalHTAvantRemise.toString())}</span></div>
                  <div className="flex justify-between text-success">
                    <span>
                      Remise {f.remiseGlobaleType === "POURCENT" ? `${Number(f.remiseGlobaleValeur)} %` : "commerciale"} (sur {f.remiseGlobaleBase})
                    </span>
                    <span className="tabular-nums">− {eur(f.remiseGlobaleMontant.toString())}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="tabular-nums">{eur(f.totalHT.toString())}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{eur(f.totalTVA.toString())}</span></div>
              <div className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Total TTC</span><span className="tabular-nums">{eur(f.totalTTC.toString())}</span></div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suivi du paiement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Payé</span><b className="tabular-nums">{eur(paye)}</b></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Part payée">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reste à payer</span><b className={cn("tabular-nums", reste > 0 && f.statut === "IMPAYEE" && "text-destructive")}>{eur(f.statut === "ANNULEE" ? 0 : reste)}</b></div>
              {f.statut === "IMPAYEE" && <p className="text-xs text-destructive">Échéance dépassée depuis le {dateFR(f.dateEcheance)}.</p>}
              {f.paiements.length > 0 && (
                <ul className="divide-y border-t pt-1">
                  {f.paiements.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <span>
                        {p.nombreFois ? `Paiement en ${p.nombreFois} fois` : LABELS.mode[p.mode]}
                        <span className="block text-xs text-muted-foreground">{dateFR(p.datePaiement)}{p.reference ? ` · ${p.reference}` : ""}</span>
                      </span>
                      <b className="tabular-nums">{eur(p.montant.toString())}</b>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mode de règlement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ModePaiementSelect factureId={f.id} valeur={f.modePaiement ?? ""} modifiable={can(user, "update", "facture") && f.statut !== "ANNULEE"} />
              {f.modePaiement === "VIREMENT" &&
                (iban ? (
                  <p className="text-xs text-muted-foreground">L&apos;IBAN et le BIC du garage figurent sur le PDF.</p>
                ) : (
                  <p className="text-xs text-destructive">
                    IBAN / BIC non renseignés : {can(user, "update", "parametre") ? <Link href="/mon-garage" className="underline">les saisir dans « Mon Garage »</Link> : "demandez à l'administrateur de les saisir"}.
                  </p>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Facturation électronique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <StatusBadge tone={f.statutPA?.startsWith("ERREUR") ? "danger" : f.statutPA ? "ok" : "neutral"}>{f.statutPA ?? "Non transmise"}</StatusBadge>
              {can(user, "update", "facture") && (
                <ConfirmButton label="Retransmettre" title="Retransmettre à la Plateforme Agréée ?" description="La facture sera renvoyée et son statut mis à jour." url={`/api/factures/${f.id}/transmettre`} method="POST" success="Facture retransmise" variant="outline" size="sm">
                  <Send aria-hidden />
                </ConfirmButton>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
