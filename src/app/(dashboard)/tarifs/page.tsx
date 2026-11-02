import type { Metadata } from "next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { LABELS } from "@/components/status-badge";
import { TarifForm } from "@/components/stock/tarif-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eur } from "@/lib/format";
import { can } from "@/lib/permissions";
import { tarifsActifs } from "@/lib/services/tarifs";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Tarifs" };

export default async function TarifsPage() {
  const user = await requirePage("read", "tarif");
  const tarifs = await tarifsActifs();
  const admin = can(user, "update", "tarif");

  return (
    <>
      <PageHeader
        title="Tarifs"
        description="Forfaits, main d'œuvre et frais divers proposés dans les devis."
        actions={
          admin && (
            <FormDialog
              title="Nouveau tarif"
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nouveau tarif
                </Button>
              }
            >
              <TarifForm />
            </FormDialog>
          )
        }
      />
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Montant HT</TableHead>
              {admin && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarifs.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{LABELS.typeTarif[t.type]}</TableCell>
                <TableCell>
                  <span className="font-medium">{t.libelle}</span>
                  {t.description && <span className="block max-w-xl text-xs whitespace-pre-line text-muted-foreground">{t.description}</span>}
                  {t.pieces.length > 0 && (
                    <span className="block text-xs text-muted-foreground">Pièces comprises : {t.pieces.map((p) => `${p.nom} (${p.reference}) × ${p.quantite}`).join(", ")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{eur(t.montantHT.toString())}</TableCell>
                {admin && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <FormDialog
                        title="Modifier le tarif"
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${t.libelle}`}>
                            <Pencil aria-hidden />
                          </Button>
                        }
                      >
                        <TarifForm tarif={{ id: t.id, type: t.type, libelle: t.libelle, description: t.description ?? "", montantHT: t.montantHT, actif: t.actif, pieces: t.pieces }} />
                      </FormDialog>
                      <ConfirmButton
                        label=""
                        title="Désactiver ce tarif ?"
                        description="Il ne sera plus proposé dans les nouveaux devis. Les devis existants ne changent pas."
                        url={`/api/tarifs/${t.id}`}
                        success="Tarif désactivé"
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 aria-hidden />
                      </ConfirmButton>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
