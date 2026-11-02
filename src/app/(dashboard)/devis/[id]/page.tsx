import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DevisActions, LienDocument } from "@/components/devis/devis-actions";
import { DevisEditor } from "@/components/devis/devis-editor";
import { CreerFactureButton } from "@/components/factures/creer-facture-button";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_DEVIS } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateFR, eur, nomClient } from "@/lib/format";
import { can, canSeeMargins } from "@/lib/permissions";
import { lireDevis } from "@/lib/services/devis";
import { montantRemise, tauxRemiseLigne } from "@/lib/remise";
import { tarifsActifs } from "@/lib/services/tarifs";
import { requirePage } from "@/lib/session";
import { jourParis } from "@/lib/time";

export const metadata: Metadata = { title: "Devis" };

export default async function DevisDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("read", "devis");
  const { id } = await params;
  const d = await lireDevis(id, user);
  if (!d) notFound();
  const marges = canSeeMargins(user);
  const modifiable = (d.statut === "ENVOYE" || d.statut === "BROUILLON") && can(user, "update", "devis");
  const [mecaniciens, tarifs] = await Promise.all([
    db.user.findMany({ where: { role: "MECANICIEN", isActive: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
    modifiable ? tarifsActifs() : [],
  ]);

  const actions = (
    <>
      {d.ordre && <LienDocument href={`/ordres-reparation/${d.ordre.id}`} libelle={d.ordre.numero} />}
      {d.bonLivraison && can(user, "read", "bonLivraison") && <LienDocument href="/bons-livraison" libelle={`${d.bonLivraison.numero} (${LABELS.statutBL[d.bonLivraison.statut].toLowerCase()})`} />}
      {d.facture && can(user, "read", "facture") && (
        <Link href={`/factures/${d.facture.id}`} className="inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-medium hover:bg-muted">
          {d.facture.numero ?? "Facture brouillon"}
        </Link>
      )}
      <DevisActions
        id={d.id}
        statut={d.statut}
        type={d.type}
        mecaniciens={mecaniciens.map((m) => ({ id: m.id, nom: `${m.firstName} ${m.lastName}` }))}
        droits={{ valider: can(user, "validate", "devis"), rouvrir: can(user, "delete", "devis"), modifier: can(user, "update", "devis") }}
        clientEmail={d.client.email}
        jourParDefaut={jourParis()}
      />
      {d.statut === "VALIDE" && !d.facture && !d.bonLivraison?.factureId && can(user, "create", "facture") && <CreerFactureButton devisId={d.id} totaux={{ totalHT: Number(d.totalHT), totalTVA: Number(d.totalTVA), totalTTC: Number(d.totalTTC) }} />}
    </>
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {d.numero}
            <StatusBadge tone={TONE_DEVIS[d.statut]}>{LABELS.statutDevis[d.statut]}</StatusBadge>
          </span>
        }
        description={`${nomClient(d.client)} · créé le ${dateFR(d.dateCreation)} par ${d.auteur} · valable jusqu'au ${dateFR(d.dateValidite)}`}
        actions={actions}
      />
      {d.statut === "REJETE" && d.motifRejet && (
        <p role="note" className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-destructive">
          Motif du rejet : {d.motifRejet}
        </p>
      )}
      {modifiable ? (
        <DevisEditor
          voirMarges={marges}
          tarifs={tarifs}
          initial={{
            id: d.id,
            type: d.type,
            client: { id: d.client.id, type: d.client.type, nom: nomClient(d.client), discountRate: Number(d.client.discountRate) },
            vehicule: d.vehicule
              ? { id: d.vehicule.id, clientId: d.vehicule.clientId, immatriculation: d.vehicule.immatriculation, marque: d.vehicule.marque, modele: d.vehicule.modele, vin: d.vehicule.vin, kilometrage: d.vehicule.kilometrage, prochainCT: d.vehicule.prochainCT ? d.vehicule.prochainCT.toISOString().slice(0, 10) : null }
              : null,
            kilometrage: d.kilometrage ?? d.vehicule?.kilometrage ?? null,
            prochainCT: d.vehicule?.prochainCT ? d.vehicule.prochainCT.toISOString().slice(0, 10) : "",
            dateValidite: d.dateValidite.toISOString().slice(0, 10),
            lignes: d.lignes.map((l) => ({
              type: l.type,
              designation: l.designation,
              quantite: String(l.quantite),
              prixUnitaireHT: String(l.prixUnitaireHT),
              tvaRate: String(l.tvaRate),
              pieceId: l.pieceId,
              tarifId: l.tarifId,
              piecesComprises: l.piecesComprises,
              stock: l.stock,
              prixAchatHT: l.prixAchatHT,
              // Sans prix catalogue enregistré : si aucune remise n'existait, le prix actuel est le prix catalogue.
              prixCatalogueHT: l.prixCatalogueHT ?? (l.type === "PIECE" && l.pieceId && d.remisePro === 0 ? l.prixUnitaireHT : null),
              prixManuel: (l.prixCatalogueHT ?? (l.type === "PIECE" && l.pieceId && d.remisePro === 0 ? l.prixUnitaireHT : null)) === null || l.type !== "PIECE" || !l.pieceId,
            })),
          }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{d.vehicule ? `${d.vehicule.marque} ${d.vehicule.modele} · ${d.vehicule.immatriculation}` : "Vente de pièces"}{d.kilometrage != null && <span className="ml-3 text-sm font-normal text-muted-foreground">{d.kilometrage.toLocaleString("fr-FR")} km</span>}</CardTitle>
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
                {d.lignes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.designation}
                      <div className="text-xs text-muted-foreground">{LABELS.typeLigne[l.type]}</div>
                      {l.prixCatalogueHT !== null && tauxRemiseLigne({ prixUnitaireHT: l.prixUnitaireHT, prixCatalogueHT: l.prixCatalogueHT }) > 0 && (
                        <div className="text-xs text-success">
                          Catalogue {eur(l.prixCatalogueHT)} · remise pro {tauxRemiseLigne({ prixUnitaireHT: l.prixUnitaireHT, prixCatalogueHT: l.prixCatalogueHT })} %
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.quantite}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(l.prixUnitaireHT)}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.tvaRate} %</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(l.totalHT)}</TableCell>
                    {marges && <TableCell className="text-right tabular-nums text-muted-foreground">{l.margeHT !== undefined ? eur(l.margeHT) : "–"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="ml-auto mt-4 w-80 space-y-1.5 text-sm">
              {d.remisePro > 0 && (
                <p className="text-xs text-success">
                  Remise professionnelle de {d.remisePro} % déduite sur les pièces ({eur(montantRemise(d.lignes))} HT).
                </p>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="tabular-nums">{eur(d.totalHT)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{eur(d.totalTVA)}</span></div>
              <div className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Total TTC</span><span className="tabular-nums">{eur(d.totalTTC)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
