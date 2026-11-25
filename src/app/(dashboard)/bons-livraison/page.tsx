import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { BonCommandeForm, BonLivraisonForm } from "@/components/bl/forms";
import { BonsCommandeTable } from "@/components/bl/bons-commande-table";
import { BonsLivraisonTable } from "@/components/bl/bons-livraison-table";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Livraisons et commandes" };

export default async function BonsPage() {
  const user = await requirePage("read", "bonCommande");
  // Bons de livraison d'abord (affichés en premier), puis bons de commande.
  const [bcs, bls] = await Promise.all([
    db.bonCommande.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { lignes: { include: { piece: { select: { reference: true, nom: true } } } } } }),
    db.bonLivraison.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true, email: true, anonymiseLe: true } }, devis: { select: { id: true, numero: true } }, facture: { select: { id: true, numero: true } }, lignes: true } }),
  ]);
  const edit = can(user, "update", "bonCommande");

  return (
    <>
      <PageHeader title="Livraisons et commandes" description="Bons de livraison clients, puis commandes aux fournisseurs et réception en stock. Aucune commande n'est passée automatiquement." />
      <div className="space-y-6">
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
                clientEmail: b.client?.anonymiseLe ? null : (b.client?.email ?? null),
                devis: b.devis,
                facture: b.facture ? { id: b.facture.id, numero: b.facture.numero ?? "Brouillon" } : null,
                pieces: b.lignes.map((l) => `${l.designation || "Pièce"} × ${l.quantite}`).join(", "),
                date: b.dateLivraison.toISOString(),
                statut: b.statut,
              }))}
            />
          </CardContent>
        </Card>

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
            <BonsCommandeTable
              edit={edit}
              rows={bcs.map((b) => ({
                id: b.id,
                numero: b.numero,
                automatique: b.automatique,
                fournisseur: b.fournisseur,
                date: b.createdAt.toISOString(),
                statut: b.statut,
                lignes: b.lignes.map((l) => ({ id: l.id, pieceId: l.pieceId, reference: l.piece.reference, nom: l.piece.nom, quantite: l.quantite, quantiteRecue: l.quantiteRecue })),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
