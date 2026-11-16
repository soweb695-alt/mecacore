"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/forms/form-dialog";
import { TarifForm } from "@/components/stock/tarif-form";
import { LABELS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/format";

export interface TarifRow {
  id: string;
  type: keyof typeof LABELS.typeTarif;
  /** Ordre d'affichage par défaut (forfaits, main d'œuvre, frais divers). */
  rang: number;
  libelle: string;
  description: string | null;
  montantHT: number;
  actif: boolean;
  pieces: { pieceId: string; reference: string; nom: string; quantite: number }[];
}

function colonnesTarifs(admin: boolean): Colonnes<TarifRow> {
  return [
    { accessorKey: "rang", header: (ctx) => <EnTete ctx={ctx} titre="Type" />, cell: ({ row }) => LABELS.typeTarif[row.original.type] },
    {
      accessorKey: "libelle",
      header: (ctx) => <EnTete ctx={ctx} titre="Libellé" />,
      cell: ({ row }) => (
        <>
          <span className="font-medium">{row.original.libelle}</span>
          {row.original.description && <span className="block max-w-xl text-xs whitespace-pre-line text-muted-foreground">{row.original.description}</span>}
          {row.original.pieces.length > 0 && <span className="block text-xs text-muted-foreground">Pièces comprises : {row.original.pieces.map((p) => `${p.nom} (${p.reference}) × ${p.quantite}`).join(", ")}</span>}
        </>
      ),
    },
    { accessorKey: "montantHT", header: (ctx) => <EnTete ctx={ctx} titre="Montant HT" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.montantHT)}</div> },
    ...(admin
      ? ([
          {
            id: "actions",
            enableSorting: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
              const t = row.original;
              return (
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
                  <ConfirmButton label="" title="Désactiver ce tarif ?" description="Il ne sera plus proposé dans les nouveaux devis. Les devis existants ne changent pas." url={`/api/tarifs/${t.id}`} success="Tarif désactivé" variant="destructive" size="sm">
                    <Trash2 aria-label={`Désactiver ${t.libelle}`} />
                  </ConfirmButton>
                </div>
              );
            },
          },
        ] satisfies Colonnes<TarifRow>)
      : []),
  ];
}

export function TarifsTable({ rows, admin }: { rows: TarifRow[]; admin: boolean }) {
  const columns = useMemo(() => colonnesTarifs(admin), [admin]);
  return <DataTable libelle="Tarifs" columns={columns} data={rows} getRowId={(t) => t.id} recherche="Filtrer les tarifs…" taillePage={50} vide="Aucun tarif actif. Ajoutez-en un avec « Nouveau tarif »." />;
}
