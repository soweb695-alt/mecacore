"use client";

import { DataTable, type PaginationServeur } from "@/components/data-table/data-table";
import { colonnesDevis, type DevisRow } from "@/components/devis/columns";

export function DevisTable({ rows, serveur }: { rows: DevisRow[]; serveur: PaginationServeur }) {
  return <DataTable libelle="Devis" columns={colonnesDevis} data={rows} getRowId={(d) => d.id} serveur={serveur} vide="Aucun devis. Créez le premier avec « Nouveau devis »." />;
}
