"use client";

import { DataTable, type PaginationServeur } from "@/components/data-table/data-table";
import { colonnesClients, type ClientRow } from "@/components/clients/columns";

export function ClientsTable({ rows, serveur }: { rows: ClientRow[]; serveur: PaginationServeur }) {
  return <DataTable libelle="Clients" columns={colonnesClients} data={rows} getRowId={(c) => c.id} serveur={serveur} vide="Aucun client ne correspond à votre recherche." />;
}
