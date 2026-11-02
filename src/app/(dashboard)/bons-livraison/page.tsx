import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { BonCommandeForm, BonLivraisonForm, ReceptionForm } from "@/components/bl/forms";
import { BonsLivraisonTable } from "@/components/bl/bons-livraison-table";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateFR, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Commandes et livraisons" };

export default async function BonsPage() {
  const user = await requirePage("read", "bonCommande");
  const [bcs, bls] = await Promise.all([
    db.bonCommande.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { lignes: { include: { piece: { select: { reference: true, nom: true } } } } } }),
    db.bonLivraison.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } }, devis: { select: { id: true, numero: true } }, facture: { select: { id: true, numero: true } }, lignes: true } }),
  ]);
  const edit = can(user, "update", "bonCommande");

  return (
    <>
      <PageHeader title="Commandes et livraisons" description="Commandes aux fournisseurs, réception en stock et bons de livraison clients. Aucune commande n'est passée automatiquement." />
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Bons de commande</CardTitle>
            {can(user, "create", "bonCommande") && (
              <FormDialog title="Nouveau bon de commande" trigger={<Button size="sm"><Plus aria-hidden />Nouveau</Button>}>
                <BonCommandeForm />
              </FormDialog>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Pièces</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-56" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bcs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Aucun bon de commande.
                    </TableCell>
                  </TableRow>
                )}
                {bcs.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.numero}
                      {b.automatique && <StatusBadge tone="warn" className="ml-2">Automatique</StatusBadge>}
                    </TableCell>
                    <TableCell>{b.fournisseur}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.lignes.map((l) => `${l.piece.reference} × ${l.quantite}`).join(", ")}</TableCell>
                    <TableCell>{dateFR(b.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={b.statut === "RECEPTIONNEE" ? "ok" : b.statut === "RECEPTIONNEE_PARTIELLE" ? "warn" : "neutral"}>{LABELS.statutBC[b.statut]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {edit && b.statut === "EN_ATTENTE" && b.lignes.every((l) => l.quantiteRecue === 0) && (
                          <>
                            <FormDialog title={`Modifier ${b.numero}`} trigger={<Button size="sm" variant="outline">Modifier</Button>}>
                              <BonCommandeForm bc={{ id: b.id, fournisseur: b.fournisseur, lignes: b.lignes.map((l) => ({ pieceId: l.pieceId, libelle: `${l.piece.reference} · ${l.piece.nom}`, quantite: l.quantite })) }} />
                            </FormDialog>
                            <ConfirmButton label="" title="Supprimer ce bon de commande ?" description="Le bon n'a pas été réceptionné : il sera supprimé définitivement." url={`/api/bons-commande/${b.id}`} success="Bon de commande supprimé" variant="destructive" size="sm">
                              <Trash2 aria-hidden />
                            </ConfirmButton>
                          </>
                        )}
                        {edit && b.statut !== "RECEPTIONNEE" && (
                          <FormDialog title={`Réception ${b.numero}`} trigger={<Button size="sm">Réceptionner</Button>}>
                            <ReceptionForm bonCommandeId={b.id} lignes={b.lignes.map((l) => ({ id: l.id, libelle: `${l.piece.reference} · ${l.piece.nom}`, commande: l.quantite, recue: l.quantiteRecue }))} />
                          </FormDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Bons de livraison <span className="text-xs font-normal text-muted-foreground">({bls.filter((b) => b.statut === "EN_ATTENTE").length} en attente · {bls.filter((b) => b.statut === "PRETE").length} à retirer)</span></CardTitle>
            {can(user, "create", "bonLivraison") && (
              <FormDialog title="Nouveau bon de livraison" trigger={<Button size="sm"><Plus aria-hidden />Nouveau</Button>}>
                <BonLivraisonForm />
              </FormDialog>
            )}
          </CardHeader>
          <CardContent>
            <BonsLivraisonTable
              peutModifier={can(user, "update", "bonLivraison")}
              peutFacturer={can(user, "create", "facture")}
              rows={bls.map((b) => ({
                id: b.id,
                numero: b.numero,
                clientId: b.clientId,
                clientNom: b.client ? nomClient(b.client) : "–",
                devis: b.devis,
                facture: b.facture ? { id: b.facture.id, numero: b.facture.numero ?? "Brouillon" } : null,
                pieces: b.lignes.map((l) => `${l.designation || "Pièce"} × ${l.quantite}`).join(", "),
                date: dateFR(b.dateLivraison),
                statut: b.statut,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
