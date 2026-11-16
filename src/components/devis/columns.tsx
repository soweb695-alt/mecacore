"use client";

import Link from "next/link";
import { EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { LABELS, StatusBadge, TONE_DEVIS } from "@/components/status-badge";
import { dateFR, eur } from "@/lib/format";

export interface DevisRow {
  id: string;
  numero: string;
  client: string;
  vehicule: string | null;
  date: string;
  statut: keyof typeof LABELS.statutDevis;
  totalTTC: number;
}

export const colonnesDevis: Colonnes<DevisRow> = [
  {
    accessorKey: "numero",
    header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
    cell: ({ row }) => (
      <Link href={`/devis/${row.original.id}`} className="font-medium hover:underline">
        {row.original.numero}
      </Link>
    ),
  },
  { accessorKey: "client", header: (ctx) => <EnTete ctx={ctx} titre="Client" /> },
  { accessorKey: "vehicule", enableSorting: false, header: "Véhicule", cell: ({ row }) => row.original.vehicule ?? "Vente de pièces" },
  { accessorKey: "date", header: (ctx) => <EnTete ctx={ctx} titre="Date" />, cell: ({ row }) => dateFR(row.original.date) },
  { accessorKey: "statut", header: (ctx) => <EnTete ctx={ctx} titre="Statut" />, cell: ({ row }) => <StatusBadge tone={TONE_DEVIS[row.original.statut]}>{LABELS.statutDevis[row.original.statut]}</StatusBadge> },
  { accessorKey: "totalTTC", header: (ctx) => <EnTete ctx={ctx} titre="Total TTC" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.totalTTC)}</div> },
];
