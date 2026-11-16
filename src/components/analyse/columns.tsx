"use client";

import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { eur } from "@/lib/format";

export interface TopPieceRow {
  id: string;
  nom: string;
  reference: string;
  qte: number;
  ca: number;
  marge: number;
}

const colonnes: Colonnes<TopPieceRow> = [
  {
    accessorKey: "nom",
    header: (ctx) => <EnTete ctx={ctx} titre="Pièce" />,
    cell: ({ row }) => (
      <>
        {row.original.nom} <span className="text-xs text-muted-foreground">{row.original.reference}</span>
      </>
    ),
  },
  { accessorKey: "qte", header: (ctx) => <EnTete ctx={ctx} titre="Quantité" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.qte}</div> },
  { accessorKey: "ca", header: (ctx) => <EnTete ctx={ctx} titre="CA HT" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.ca)}</div> },
  { accessorKey: "marge", header: (ctx) => <EnTete ctx={ctx} titre="Marge" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.marge)}</div> },
];

export function TopPiecesTable({ rows }: { rows: TopPieceRow[] }) {
  return <DataTable libelle="Pièces les plus vendues" columns={colonnes} data={rows} getRowId={(p) => p.id} triInitial={[{ id: "ca", desc: true }]} sansPagination vide="Aucune vente de pièce sur la période." />;
}
