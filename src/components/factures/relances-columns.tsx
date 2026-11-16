"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { RelanceButton } from "@/components/factures/relance-button";
import { dateFR, eur } from "@/lib/format";

export interface RelanceRow {
  id: string;
  numero: string;
  client: { id: string; nom: string; contact: string };
  echeance: string;
  joursRetard: number;
  reste: number;
  nombreRelances: number;
  derniereRelance: string | null;
}

function colonnesRelances(peutRelancer: boolean): Colonnes<RelanceRow> {
  return [
    {
      accessorKey: "numero",
      header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
      cell: ({ row }) => (
        <Link href={`/factures/${row.original.id}`} className="font-medium hover:underline">
          {row.original.numero}
        </Link>
      ),
    },
    {
      id: "client",
      accessorFn: (r) => r.client.nom,
      header: (ctx) => <EnTete ctx={ctx} titre="Client" />,
      cell: ({ row }) => (
        <>
          <Link href={`/clients/${row.original.client.id}`} className="hover:underline">
            {row.original.client.nom}
          </Link>
          <span className="block text-xs text-muted-foreground">{row.original.client.contact}</span>
        </>
      ),
    },
    { accessorKey: "echeance", header: (ctx) => <EnTete ctx={ctx} titre="Échéance" />, cell: ({ row }) => dateFR(row.original.echeance) },
    { accessorKey: "joursRetard", header: (ctx) => <EnTete ctx={ctx} titre="Retard" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums text-destructive">{row.original.joursRetard} j</div> },
    { accessorKey: "reste", header: (ctx) => <EnTete ctx={ctx} titre="Reste dû" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.reste)}</div> },
    { accessorKey: "nombreRelances", header: (ctx) => <EnTete ctx={ctx} titre="Nombre de relances" align="right" />, cell: ({ row }) => <div className="text-right font-semibold tabular-nums">{row.original.nombreRelances}</div> },
    { accessorKey: "derniereRelance", sortUndefined: "first", header: (ctx) => <EnTete ctx={ctx} titre="Dernière relance" />, cell: ({ row }) => (row.original.derniereRelance ? dateFR(row.original.derniereRelance) : <span className="text-muted-foreground">Jamais</span>) },
    ...(peutRelancer
      ? ([{ id: "action", enableSorting: false, header: () => <span className="block text-right">Action</span>, cell: ({ row }) => <div className="text-right"><RelanceButton factureId={row.original.id} numero={row.original.numero} /></div> }] satisfies Colonnes<RelanceRow>)
      : []),
  ];
}

export function RelancesTable({ rows, peutRelancer }: { rows: RelanceRow[]; peutRelancer: boolean }) {
  const columns = useMemo(() => colonnesRelances(peutRelancer), [peutRelancer]);
  return <DataTable libelle="Factures à relancer" columns={columns} data={rows} getRowId={(r) => r.id} triInitial={[{ id: "joursRetard", desc: true }]} recherche="Filtrer par n° ou client…" vide="Aucune facture impayée. Rien à relancer." />;
}
