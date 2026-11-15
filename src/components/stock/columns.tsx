"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { StatusBadge } from "@/components/status-badge";
import { VignettePiece } from "@/components/stock/piece-image";
import { eur } from "@/lib/format";

export interface PieceRow {
  id: string;
  reference: string;
  nom: string;
  imageMaj: string | null;
  referenceCroisee: string | null;
  referencesCroisees: string[];
  fournisseur: string | null;
  prixAchatHT?: number;
  prixVenteHT: number;
  margePct?: number;
  stock: number;
  seuilAlerte: number;
  enAlerte: boolean;
}

/** Colonnes du stock : prix d'achat et marge seulement pour les rôles autorisés (absents des données sinon). */
export function colonnesStock({ achat, marges }: { achat: boolean; marges: boolean }): Colonnes<PieceRow> {
  return [
    {
      accessorKey: "reference",
      header: (ctx) => <EnTete ctx={ctx} titre="Référence" />,
      cell: ({ row }) => (
        <Link href={`/stock/${row.original.id}`} className="flex items-center gap-2 font-medium hover:underline">
          <VignettePiece id={row.original.id} version={row.original.imageMaj} nom={row.original.nom} />
          {row.original.reference}
        </Link>
      ),
    },
    {
      accessorKey: "nom",
      header: (ctx) => <EnTete ctx={ctx} titre="Désignation" />,
      cell: ({ row }) => (
        <>
          {row.original.nom}
          {row.original.referenceCroisee && <div className="text-xs font-medium text-link">Équivalent de {row.original.referenceCroisee}</div>}
          {row.original.referencesCroisees.length > 0 && <div className="text-xs text-muted-foreground">Croisées : {row.original.referencesCroisees.join(", ")}</div>}
        </>
      ),
    },
    { accessorKey: "fournisseur", header: (ctx) => <EnTete ctx={ctx} titre="Fournisseur" />, cell: ({ row }) => row.original.fournisseur ?? "–" },
    ...(achat
      ? ([{ accessorKey: "prixAchatHT", header: (ctx) => <EnTete ctx={ctx} titre="Prix achat HT" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.prixAchatHT !== undefined ? eur(row.original.prixAchatHT) : "–"}</div> }] satisfies Colonnes<PieceRow>)
      : []),
    { accessorKey: "prixVenteHT", header: (ctx) => <EnTete ctx={ctx} titre="Prix vente HT" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{eur(row.original.prixVenteHT)}</div> },
    ...(marges
      ? ([{ accessorKey: "margePct", enableSorting: false, header: () => <span className="block text-right">Marge</span>, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.margePct !== undefined ? `${row.original.margePct} %` : "–"}</div> }] satisfies Colonnes<PieceRow>)
      : []),
    {
      accessorKey: "stock",
      header: (ctx) => <EnTete ctx={ctx} titre="Stock" />,
      cell: ({ row }) =>
        row.original.enAlerte ? (
          <StatusBadge tone="warn">
            <AlertTriangle className="size-3" aria-hidden />
            {row.original.stock} / seuil {row.original.seuilAlerte}
          </StatusBadge>
        ) : (
          <StatusBadge tone="ok">{row.original.stock}</StatusBadge>
        ),
    },
  ];
}
