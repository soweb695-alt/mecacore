import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PieceForm } from "@/components/stock/piece-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { eur } from "@/lib/format";
import { can, canSeePurchasePrice } from "@/lib/permissions";
import { pieceVue } from "@/lib/services/pieces";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Fiche pièce" };

export default async function FichePiece({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("read", "piece");
  const { id } = await params;
  const brut = await db.piece.findUnique({ where: { id } });
  if (!brut) notFound();
  const p = pieceVue(brut, user);
  const achat = canSeePurchasePrice(user);
  const utilisations = await db.ligneDevis.findMany({
    where: { pieceId: id, devis: { statut: { in: ["ENVOYE", "VALIDE"] } } },
    orderBy: { devis: { dateCreation: "desc" } },
    take: 8,
    select: { quantite: true, devis: { select: { id: true, numero: true, statut: true } } },
  });

  return (
    <>
      <PageHeader
        title={p.nom}
        description={`Référence ${p.reference}${p.marque ? ` · ${p.marque}` : ""}`}
        actions={
          <>
            {can(user, "update", "piece") && (
              <FormDialog
                title="Modifier la pièce"
                wide
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden />
                    Modifier
                  </Button>
                }
              >
                <PieceForm
                  voirAchat={achat}
                  piece={{
                    id: p.id,
                    reference: p.reference,
                    nom: p.nom,
                    marque: p.marque,
                    fournisseur: p.fournisseur,
                    categorie: p.categorie,
                    prixAchatHT: p.prixAchatHT,
                    prixVenteHT: p.prixVenteHT,
                    stock: p.stock,
                    seuilAlerte: p.seuilAlerte,
                    taillePneu: p.taillePneu,
                    referencesCroisees: p.referencesCroisees,
                  }}
                />
              </FormDialog>
            )}
            {can(user, "delete", "piece") && (
              <ConfirmButton
                label="Désactiver"
                title="Désactiver cette pièce ?"
                description="La pièce n'apparaîtra plus dans le stock ni dans les nouveaux devis. L'historique est conservé."
                url={`/api/stock/${p.id}`}
                success="Pièce désactivée"
                redirectTo="/stock"
                variant="destructive"
                size="default"
              >
                <Trash2 aria-hidden />
              </ConfirmButton>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold">{p.stock}</div>
            <StatusBadge tone={p.enAlerte ? "warn" : "ok"}>{p.enAlerte ? `Sous le seuil (${p.seuilAlerte})` : `Seuil d'alerte : ${p.seuilAlerte}`}</StatusBadge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Vente HT : <b>{eur(p.prixVenteHT)}</b></div>
            {p.prixAchatHT !== undefined && <div>Achat HT : <b>{eur(p.prixAchatHT)}</b></div>}
            {p.margePct !== undefined && <div>Marge : <b>{p.margePct} %</b></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Fournisseur : {p.fournisseur ?? "–"}</div>
            <div>Catégorie : {p.categorie ?? "–"}</div>
            {p.taillePneu && <div>Pneu : {p.taillePneu}</div>}
            <div>Références croisées : {p.referencesCroisees.length ? p.referencesCroisees.join(", ") : "–"}</div>
          </CardContent>
        </Card>
      </div>
      {can(user, "read", "devis") && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Derniers devis utilisant cette pièce</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {utilisations.length === 0 && <p className="text-muted-foreground">Aucun devis en cours.</p>}
            {utilisations.map((u, i) => (
              <Link key={i} href={`/devis/${u.devis.id}`} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-muted/50">
                <span className="font-medium">{u.devis.numero}</span>
                <span className="text-muted-foreground">× {Number(u.quantite)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
