"use client";

import { useMemo } from "react";
import { DataTable, type PaginationServeur } from "@/components/data-table/data-table";
import { colonnesStock, type PieceRow } from "@/components/stock/columns";

export function StockTable({ rows, serveur, achat, marges }: { rows: PieceRow[]; serveur: PaginationServeur; achat: boolean; marges: boolean }) {
  const columns = useMemo(() => colonnesStock({ achat, marges }), [achat, marges]);
  return (
    <DataTable
      libelle="Pièces du stock"
      columns={columns}
      data={rows}
      getRowId={(p) => p.id}
      serveur={serveur}
      vide="Aucune pièce ne correspond à votre recherche."
      ligneClassName={(p) => (p.enAlerte ? "bg-warning-bg/40" : undefined)}
    />
  );
}
