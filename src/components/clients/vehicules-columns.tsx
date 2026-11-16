"use client";

import Link from "next/link";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { StatusBadge } from "@/components/status-badge";
import { dateFR } from "@/lib/format";

export interface VehiculeRow {
  id: string;
  immatriculation: string;
  vehicule: string;
  motorisation: string | null;
  kilometrage: number | null;
  prochainCT: string | null;
  client: { id: string; nom: string } | null;
}

export const colonnesVehicules: Colonnes<VehiculeRow> = [
  {
    accessorKey: "immatriculation",
    header: (ctx) => <EnTete ctx={ctx} titre="Plaque" />,
    cell: ({ row }) => (
      <Link href={`/vehicules/${row.original.id}`} className="font-medium hover:underline">
        {row.original.immatriculation}
      </Link>
    ),
  },
  {
    accessorKey: "vehicule",
    header: (ctx) => <EnTete ctx={ctx} titre="Véhicule" />,
    cell: ({ row }) => (
      <>
        {row.original.vehicule}
        {row.original.motorisation && <div className="text-xs text-muted-foreground">{row.original.motorisation}</div>}
      </>
    ),
  },
  { accessorKey: "kilometrage", sortUndefined: "last", header: (ctx) => <EnTete ctx={ctx} titre="Kilométrage" />, cell: ({ row }) => <span className="tabular-nums">{row.original.kilometrage != null ? `${row.original.kilometrage.toLocaleString("fr-FR")} km` : "–"}</span> },
  { accessorKey: "prochainCT", sortUndefined: "last", header: (ctx) => <EnTete ctx={ctx} titre="Prochain CT" />, cell: ({ row }) => dateFR(row.original.prochainCT) },
  {
    id: "client",
    accessorFn: (v) => v.client?.nom ?? "",
    header: (ctx) => <EnTete ctx={ctx} titre="Client associé" />,
    cell: ({ row }) =>
      row.original.client ? (
        <Link href={`/clients/${row.original.client.id}`} className="hover:underline">
          {row.original.client.nom}
        </Link>
      ) : (
        <StatusBadge>Sans client</StatusBadge>
      ),
  },
];

export function VehiculesTable({ rows }: { rows: VehiculeRow[] }) {
  return <DataTable libelle="Véhicules" columns={colonnesVehicules} data={rows} getRowId={(v) => v.id} recherche="Filtrer ces véhicules…" vide="Aucun véhicule trouvé. Créez-le avec « Nouveau véhicule »." />;
}
