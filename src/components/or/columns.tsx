"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { PreparerFactureButton } from "@/components/or/preparer-facture-button";
import { LABELS, StatusBadge, TONE_ORDRE } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { dateFR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface OrdreRow {
  id: string;
  numero: string;
  vehicule: string | null;
  client: string;
  technicien: string | null;
  statut: keyof typeof LABELS.statutOrdre;
  fiche: "TRANSMISE" | "TRAITEE" | "EN_COURS" | null;
  date: string;
  kilometrage: number | null;
  /** Onglet « À traiter par le Magasin » : actions possibles (selon les droits). */
  actions?: { preparer: boolean; facture: { id: string; libelle: string } | null; devisComplementaire: string | null };
}

const FICHE: Record<NonNullable<OrdreRow["fiche"]>, React.ReactNode> = {
  TRANSMISE: <StatusBadge tone="warn">Transmise</StatusBadge>,
  TRAITEE: <StatusBadge tone="ok">Traitée</StatusBadge>,
  EN_COURS: <span className="text-muted-foreground">En cours</span>,
};

export function colonnesOrdres(magasin: boolean): Colonnes<OrdreRow> {
  return [
    {
      accessorKey: "numero",
      header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
      cell: ({ row }) => (
        <Link href={`/ordres-reparation/${row.original.id}`} className="font-medium hover:underline">
          {row.original.numero}
        </Link>
      ),
    },
    { accessorKey: "vehicule", header: (ctx) => <EnTete ctx={ctx} titre="Véhicule" />, cell: ({ row }) => row.original.vehicule ?? "–" },
    { accessorKey: "client", header: (ctx) => <EnTete ctx={ctx} titre="Client" /> },
    { accessorKey: "technicien", header: (ctx) => <EnTete ctx={ctx} titre="Technicien" />, cell: ({ row }) => row.original.technicien ?? "Non assigné" },
    { accessorKey: "statut", header: (ctx) => <EnTete ctx={ctx} titre="Statut" />, cell: ({ row }) => <StatusBadge tone={TONE_ORDRE[row.original.statut]}>{LABELS.statutOrdre[row.original.statut]}</StatusBadge> },
    { accessorKey: "fiche", header: (ctx) => <EnTete ctx={ctx} titre="Fiche de contrôle" />, cell: ({ row }) => (row.original.fiche ? FICHE[row.original.fiche] : <span className="text-muted-foreground">–</span>) },
    { accessorKey: "date", header: (ctx) => <EnTete ctx={ctx} titre={magasin ? "Terminé le" : "Créé le"} />, cell: ({ row }) => dateFR(row.original.date) },
    { accessorKey: "kilometrage", sortUndefined: "last", header: (ctx) => <EnTete ctx={ctx} titre="Kilométrage" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.kilometrage != null ? `${row.original.kilometrage.toLocaleString("fr-FR")} km` : "–"}</div> },
    ...(magasin
      ? ([
          {
            id: "actions",
            enableSorting: false,
            enableGlobalFilter: false,
            header: () => <span className="block text-right">Actions</span>,
            cell: ({ row }) => {
              const a = row.original.actions;
              if (!a) return null;
              return (
                <div className="flex justify-end gap-2">
                  {a.preparer && <PreparerFactureButton ordreId={row.original.id} />}
                  {a.facture && (
                    <Link href={`/factures/${a.facture.id}`} className={cn(buttonVariants({ size: "sm" }))}>
                      {a.facture.libelle}
                    </Link>
                  )}
                  {a.devisComplementaire && (
                    <Link href={a.devisComplementaire} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      Devis complémentaire
                    </Link>
                  )}
                </div>
              );
            },
          },
        ] satisfies Colonnes<OrdreRow>)
      : []),
  ];
}

/** `compact` : extrait court (tableau de bord), sans recherche ni pagination. */
export function OrdresTable({ rows, magasin, compact = false }: { rows: OrdreRow[]; magasin: boolean; compact?: boolean }) {
  const columns = useMemo(() => colonnesOrdres(magasin), [magasin]);
  return (
    <DataTable
      libelle="Ordres de réparation"
      columns={columns}
      data={rows}
      getRowId={(o) => o.id}
      recherche={compact ? undefined : "Filtrer par n°, véhicule, client…"}
      sansPagination={compact}
      vide={magasin ? "Aucun ordre de réparation à traiter." : "Aucun ordre de réparation : ils sont créés à la validation d'un devis mécanique."}
    />
  );
}
