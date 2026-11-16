import {
  columnFilteringFeature,
  constructFilterFn,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";

/** Recherche insensible à la casse et aux accents : « helene » trouve « Hélène ». */
const normaliser = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
const texte = constructFilterFn({ ...filterFn_includesString, resolveFilterValue: normaliser, resolveDataValue: normaliser });

/**
 * Fonctionnalités communes à toutes les listes : tri, recherche, sélection de lignes, pagination.
 * Objet stable au niveau du module (exigence de TanStack Table v9). Les étapes filtrage → tri → pagination
 * sont faites dans le navigateur, sauf pour les listes paginées par le serveur (`manual*`).
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { texte },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime, basic: sortFn_basic },
  rowSelectionFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/** Colonnes d'une liste (fichier `columns.tsx` de chaque domaine). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- chaque colonne a son propre type de valeur
export type Colonnes<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>[];
