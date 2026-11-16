"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { VehiculeForm } from "@/components/clients/vehicule-form";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/forms/form-dialog";
import { LABELS, StatusBadge, TONE_DEVIS, TONE_FACTURE } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateFR, eur } from "@/lib/format";

const km = (n: number | null) => (n != null ? `${n.toLocaleString("fr-FR")} km` : "–");

/* ---------- Fiche client : véhicules ---------- */

export interface VehiculeClientRow {
  id: string;
  immatriculation: string;
  vehicule: string;
  motorisation: string | null;
  /** Valeurs du formulaire de modification. */
  formulaire: { id: string; immatriculation: string; marque: string; modele: string; annee: number | null; vin: string; motorisation: string; kilometrage: number | null; prochainCT: string };
}

function colonnesVehiculesClient(modifier: { clientId: string; clientNom: string } | null): Colonnes<VehiculeClientRow> {
  return [
    {
      accessorKey: "immatriculation",
      header: (ctx) => <EnTete ctx={ctx} titre="Plaque" />,
      cell: ({ row }) => (
        <Link href={`/vehicules/${row.original.id}`} className="font-medium hover:underline">
          {row.original.immatriculation}
        </Link>
      ),
    },
    { accessorKey: "vehicule", header: (ctx) => <EnTete ctx={ctx} titre="Véhicule" /> },
    { accessorKey: "motorisation", header: (ctx) => <EnTete ctx={ctx} titre="Motorisation" />, cell: ({ row }) => row.original.motorisation ?? "–" },
    ...(modifier
      ? ([
          {
            id: "actions",
            enableSorting: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
              <FormDialog
                title="Modifier le véhicule"
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${row.original.immatriculation}`}>
                    <Pencil aria-hidden />
                  </Button>
                }
              >
                <VehiculeForm clientId={modifier.clientId} clientNom={modifier.clientNom} vehicule={row.original.formulaire} />
              </FormDialog>
            ),
          },
        ] satisfies Colonnes<VehiculeClientRow>)
      : []),
  ];
}

export function VehiculesClientTable({ rows, modifier }: { rows: VehiculeClientRow[]; modifier: { clientId: string; clientNom: string } | null }) {
  const clientId = modifier?.clientId;
  const clientNom = modifier?.clientNom;
  const columns = useMemo(() => colonnesVehiculesClient(clientId && clientNom !== undefined ? { clientId, clientNom } : null), [clientId, clientNom]);
  return <DataTable libelle="Véhicules du client" columns={columns} data={rows} getRowId={(v) => v.id} sansPagination vide="Aucun véhicule enregistré pour ce client." />;
}

/* ---------- Fiche véhicule : historique des devis ---------- */

export interface HistoriqueDevisRow {
  id: string;
  numero: string;
  date: string;
  kilometrage: number | null;
  statut: keyof typeof LABELS.statutDevis;
  totalTTC: number;
}

const colonnesHistoriqueDevis: Colonnes<HistoriqueDevisRow> = [
  {
    accessorKey: "numero",
    header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
    cell: ({ row }) => (
      <Link href={`/devis/${row.original.id}`} className="font-medium hover:underline">
        {row.original.numero}
      </Link>
    ),
  },
  { accessorKey: "date", header: (ctx) => <EnTete ctx={ctx} titre="Date" />, cell: ({ row }) => dateFR(row.original.date) },
  { accessorKey: "kilometrage", sortUndefined: "last", header: (ctx) => <EnTete ctx={ctx} titre="Kilométrage" />, cell: ({ row }) => <span className="tabular-nums">{km(row.original.kilometrage)}</span> },
  { accessorKey: "statut", header: (ctx) => <EnTete ctx={ctx} titre="Statut" />, cell: ({ row }) => <StatusBadge tone={TONE_DEVIS[row.original.statut]}>{LABELS.statutDevis[row.original.statut]}</StatusBadge> },
  { accessorKey: "totalTTC", header: (ctx) => <EnTete ctx={ctx} titre="Total TTC" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.totalTTC)}</div> },
];

export function HistoriqueDevisTable({ rows }: { rows: HistoriqueDevisRow[] }) {
  return <DataTable libelle="Historique des devis" columns={colonnesHistoriqueDevis} data={rows} getRowId={(d) => d.id} taillePage={10} vide="Aucun devis pour ce véhicule." />;
}

/* ---------- Fiche véhicule : historique des factures ---------- */

export interface HistoriqueFactureRow {
  id: string;
  numero: string | null;
  emission: string;
  statut: keyof typeof LABELS.statutFacture;
  totalTTC: number;
}

const colonnesHistoriqueFactures: Colonnes<HistoriqueFactureRow> = [
  {
    accessorKey: "numero",
    header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
    cell: ({ row }) => (
      <Link href={`/factures/${row.original.id}`} className="font-medium hover:underline">
        {row.original.numero ?? "Brouillon"}
      </Link>
    ),
  },
  { accessorKey: "emission", header: (ctx) => <EnTete ctx={ctx} titre="Émission" />, cell: ({ row }) => dateFR(row.original.emission) },
  { accessorKey: "statut", header: (ctx) => <EnTete ctx={ctx} titre="Statut" />, cell: ({ row }) => <StatusBadge tone={TONE_FACTURE[row.original.statut]}>{LABELS.statutFacture[row.original.statut]}</StatusBadge> },
  { accessorKey: "totalTTC", header: (ctx) => <EnTete ctx={ctx} titre="Total TTC" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.totalTTC)}</div> },
];

export function HistoriqueFacturesTable({ rows }: { rows: HistoriqueFactureRow[] }) {
  return <DataTable libelle="Historique des factures" columns={colonnesHistoriqueFactures} data={rows} getRowId={(f) => f.id} taillePage={10} vide="Aucune facture pour ce véhicule." />;
}
