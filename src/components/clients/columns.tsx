"use client";

import Link from "next/link";
import { EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { StatusBadge } from "@/components/status-badge";
import { eur } from "@/lib/format";

export interface ClientRow {
  id: string;
  nom: string;
  detail: string | null;
  type: "PARTICULIER" | "PRO";
  telephone: string | null;
  vehicules: number;
  ca: number;
  marketing: boolean;
}

export const colonnesClients: Colonnes<ClientRow> = [
  {
    accessorKey: "nom",
    header: (ctx) => <EnTete ctx={ctx} titre="Client" />,
    cell: ({ row }) => (
      <>
        <Link href={`/clients/${row.original.id}`} className="font-medium hover:underline">
          {row.original.nom}
        </Link>
        {row.original.detail && <div className="text-xs text-muted-foreground">{row.original.detail}</div>}
      </>
    ),
  },
  {
    accessorKey: "type",
    header: (ctx) => <EnTete ctx={ctx} titre="Type" />,
    cell: ({ row }) => <StatusBadge tone={row.original.type === "PRO" ? "info" : "neutral"}>{row.original.type === "PRO" ? "Pro" : "Particulier"}</StatusBadge>,
  },
  { accessorKey: "telephone", enableSorting: false, header: "Téléphone", cell: ({ row }) => row.original.telephone ?? "–" },
  { accessorKey: "vehicules", enableSorting: false, header: "Véhicules" },
  { accessorKey: "ca", enableSorting: false, header: () => <span className="block text-right">CA cumulé</span>, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.ca)}</div> },
  {
    accessorKey: "marketing",
    header: (ctx) => <EnTete ctx={ctx} titre="Marketing" />,
    cell: ({ row }) => <StatusBadge tone={row.original.marketing ? "ok" : "neutral"}>{row.original.marketing ? "Opt-in" : "Non"}</StatusBadge>,
  },
];
