"use client";

import Link from "next/link";
import { colonneSelection, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { LABELS, StatusBadge, TONE_FACTURE } from "@/components/status-badge";
import { dateFR, eur } from "@/lib/format";

export interface FactureRow {
  id: string;
  numero: string | null;
  client: string;
  /** ISO ; null pour un brouillon (pas encore émis). */
  emission: string | null;
  echeance: string;
  statut: keyof typeof LABELS.statutFacture;
  totalTTC: number;
  /** null : facture annulée ou brouillon. */
  reste: number | null;
}

export function colonnesFactures(selection: boolean): Colonnes<FactureRow> {
  return [
    ...(selection ? [colonneSelection<FactureRow>((f) => f.numero ?? "le brouillon")] : []),
    {
      accessorKey: "numero",
      header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
      cell: ({ row }) => (
        <Link href={`/factures/${row.original.id}`} className="font-medium hover:underline">
          {row.original.numero ?? <span className="text-muted-foreground italic">Brouillon (à émettre)</span>}
        </Link>
      ),
    },
    { accessorKey: "client", header: (ctx) => <EnTete ctx={ctx} titre="Client" /> },
    { accessorKey: "emission", header: (ctx) => <EnTete ctx={ctx} titre="Émission" />, cell: ({ row }) => (row.original.emission ? dateFR(row.original.emission) : "–") },
    { accessorKey: "echeance", header: (ctx) => <EnTete ctx={ctx} titre="Échéance" />, cell: ({ row }) => dateFR(row.original.echeance) },
    {
      accessorKey: "statut",
      header: (ctx) => <EnTete ctx={ctx} titre="Statut" />,
      cell: ({ row }) => <StatusBadge tone={TONE_FACTURE[row.original.statut]}>{LABELS.statutFacture[row.original.statut]}</StatusBadge>,
    },
    { accessorKey: "totalTTC", header: (ctx) => <EnTete ctx={ctx} titre="Total TTC" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.totalTTC)}</div> },
    { accessorKey: "reste", enableSorting: false, header: (ctx) => <EnTete ctx={ctx} titre="Reste dû" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.reste === null ? "–" : eur(row.original.reste)}</div> },
  ];
}
