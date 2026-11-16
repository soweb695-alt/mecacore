"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { DataTable, EnTete, type PaginationServeur } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/forms/form-dialog";
import { RetourForm, type RetourFormValeur } from "@/components/retours/retour-form";
import { LABELS, StatusBadge, TONE_RETOUR } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateFR, eur } from "@/lib/format";

export interface RetourRow {
  id: string;
  numero: string;
  type: keyof typeof LABELS.typeRetour;
  designation: string;
  detail: string | null;
  notes: string | null;
  quantite: number;
  client: { id: string; nom: string } | null;
  ordre: { id: string; numero: string } | null;
  dateEntree: string;
  dateTraitement: string | null;
  consigneHT: number | null;
  statut: keyof typeof LABELS.statutRetour;
  /** Valeurs du formulaire de modification. */
  formulaire: RetourFormValeur;
}

function colonnesRetours({ peutModifier, peutSupprimer, aujourdhui }: { peutModifier: boolean; peutSupprimer: boolean; aujourdhui: string }): Colonnes<RetourRow> {
  return [
    { accessorKey: "numero", header: (ctx) => <EnTete ctx={ctx} titre="N°" />, cell: ({ row }) => <span className="font-medium">{row.original.numero}</span> },
    { accessorKey: "type", header: (ctx) => <EnTete ctx={ctx} titre="Type" />, cell: ({ row }) => <span className="text-xs">{LABELS.typeRetour[row.original.type]}</span> },
    {
      accessorKey: "designation",
      header: (ctx) => <EnTete ctx={ctx} titre="Pièce" />,
      cell: ({ row }) => (
        <>
          <span className="font-medium">{row.original.designation}</span>
          {row.original.detail && <span className="block text-xs text-muted-foreground">{row.original.detail}</span>}
          {row.original.notes && (
            <span className="block max-w-xs truncate text-xs text-muted-foreground" title={row.original.notes}>
              {row.original.notes}
            </span>
          )}
        </>
      ),
    },
    { accessorKey: "quantite", enableSorting: false, header: () => <span className="block text-right">Qté</span>, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.quantite}</div> },
    {
      id: "client",
      enableSorting: false,
      header: "Client / OR",
      cell: ({ row }) => (
        <>
          {row.original.client ? (
            <Link href={`/clients/${row.original.client.id}`} className="hover:underline">
              {row.original.client.nom}
            </Link>
          ) : (
            <span className="text-muted-foreground">–</span>
          )}
          {row.original.ordre && (
            <Link href={`/ordres-reparation/${row.original.ordre.id}`} className="block text-xs text-muted-foreground hover:underline">
              {row.original.ordre.numero}
            </Link>
          )}
        </>
      ),
    },
    {
      accessorKey: "dateEntree",
      header: (ctx) => <EnTete ctx={ctx} titre="Entrée" />,
      cell: ({ row }) => (
        <>
          {dateFR(row.original.dateEntree)}
          {row.original.dateTraitement && <span className="block text-xs text-muted-foreground">traité le {dateFR(row.original.dateTraitement)}</span>}
        </>
      ),
    },
    { accessorKey: "consigneHT", header: (ctx) => <EnTete ctx={ctx} titre="Consigne HT" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.consigneHT !== null ? eur(row.original.consigneHT) : "–"}</div> },
    { accessorKey: "statut", header: (ctx) => <EnTete ctx={ctx} titre="Statut" />, cell: ({ row }) => <StatusBadge tone={TONE_RETOUR[row.original.statut]}>{LABELS.statutRetour[row.original.statut]}</StatusBadge> },
    ...(peutModifier || peutSupprimer
      ? ([
          {
            id: "actions",
            enableSorting: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => {
              const r = row.original;
              return (
                <div className="flex justify-end gap-1">
                  {peutModifier && (
                    <FormDialog
                      title={`Modifier ${r.numero}`}
                      wide
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${r.numero}`}>
                          <Pencil aria-hidden />
                        </Button>
                      }
                    >
                      <RetourForm aujourdhui={aujourdhui} retour={r.formulaire} />
                    </FormDialog>
                  )}
                  {peutSupprimer && (
                    <ConfirmButton label="" title={`Supprimer ${r.numero} ?`} description="Le retour est définitivement supprimé. Pour un retour traité, préférez le statut « Clôturée »." url={`/api/retours/${r.id}`} success="Retour supprimé" variant="destructive" size="sm">
                      <Trash2 aria-label={`Supprimer ${r.numero}`} />
                    </ConfirmButton>
                  )}
                </div>
              );
            },
          },
        ] satisfies Colonnes<RetourRow>)
      : []),
  ];
}

export function RetoursTable({ rows, serveur, peutModifier, peutSupprimer, aujourdhui }: { rows: RetourRow[]; serveur: PaginationServeur; peutModifier: boolean; peutSupprimer: boolean; aujourdhui: string }) {
  const columns = useMemo(() => colonnesRetours({ peutModifier, peutSupprimer, aujourdhui }), [peutModifier, peutSupprimer, aujourdhui]);
  return <DataTable libelle="Retours et consignes" columns={columns} data={rows} getRowId={(r) => r.id} serveur={serveur} vide="Aucun retour ni pièce consignée. Enregistrez-en un avec « Nouveau retour »." />;
}
