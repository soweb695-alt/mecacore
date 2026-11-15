"use client";

import { useTable, type RowData, type RowSelectionState, type SortingState, type Updater, type HeaderContext, type CellContext } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dataTableFeatures, type Colonnes, type DataTableFeatures } from "./data-table-features";

/** Liste paginée et triée par le serveur : l'état vit dans l'URL (?page=, ?tri=, ?ordre=). */
export interface PaginationServeur {
  page: number;
  pages: number;
  total: number;
  tri?: string;
  ordre?: "asc" | "desc";
}

interface Props<TData extends RowData> {
  columns: Colonnes<TData>;
  data: TData[];
  getRowId: (row: TData) => string;
  /** Message quand la liste est vide (concret : que faire pour la remplir). */
  vide: string;
  /** Champ de recherche dans la liste (listes chargées en entier uniquement). */
  recherche?: string;
  taillePage?: number;
  /** Pas de pagination (listes courtes : résumé, fiche). */
  sansPagination?: boolean;
  serveur?: PaginationServeur;
  triInitial?: SortingState;
  /** Barre d'actions sur la sélection : reçoit les identifiants cochés et une fonction pour vider la sélection. */
  actionsSelection?: (ids: string[], vider: () => void) => ReactNode;
  /** Texte du compteur de sélection (ex. « 2 factures sélectionnées »). */
  compteSelection?: (n: number) => string;
  ligneClassName?: (row: TData) => string | undefined;
  /** Libellé accessible de la liste. */
  libelle: string;
}

/**
 * Data Table (shadcn/ui + TanStack Table v9) utilisé par toutes les listes de l'application.
 * Les colonnes sont définies dans le fichier `columns.tsx` de chaque domaine.
 */
export function DataTable<TData extends RowData>({ columns, data, getRowId, vide, recherche, taillePage = 25, sansPagination = false, serveur, triInitial = [], actionsSelection, compteSelection = (n) => `${n} ligne${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`, ligneClassName, libelle }: Props<TData>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [triLocal, setTriLocal] = useState<SortingState>(triInitial);
  const [filtre, setFiltre] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: sansPagination ? Math.max(data.length, 1) : taillePage });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const naviguer = (modif: Record<string, string | null>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(modif)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`${pathname}?${sp.toString()}`);
  };

  const triServeur: SortingState = serveur?.tri ? [{ id: serveur.tri, desc: serveur.ordre === "desc" }] : [];
  const sorting = serveur ? triServeur : triLocal;

  function changerTri(maj: Updater<SortingState>) {
    const suivant = typeof maj === "function" ? maj(sorting) : maj;
    if (!serveur) return setTriLocal(suivant);
    const t = suivant[0];
    naviguer({ tri: t ? t.id : null, ordre: t ? (t.desc ? "desc" : "asc") : null, page: null });
  }

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    state: {
      sorting,
      globalFilter: filtre,
      rowSelection,
      pagination: serveur ? { pageIndex: serveur.page - 1, pageSize: Math.max(data.length, 1) } : sansPagination ? { pageIndex: 0, pageSize: Math.max(data.length, 1) } : pagination,
    },
    onSortingChange: changerTri,
    onGlobalFilterChange: setFiltre,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    globalFilterFn: "texte",
    enableSortingRemoval: true,
    manualSorting: !!serveur,
    manualPagination: !!serveur,
    manualFiltering: !!serveur,
    ...(serveur ? { pageCount: serveur.pages } : {}),
  });

  const lignes = table.getRowModel().rows;
  const nbColonnes = table.getAllLeafColumns().length;
  const selection = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const page = serveur ? serveur.page : table.state.pagination.pageIndex + 1;
  const pages = serveur ? serveur.pages : table.getPageCount();
  const total = serveur ? serveur.total : table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-3">
      {(recherche || actionsSelection) && (
        <div className="flex flex-wrap items-center gap-2">
          {recherche && !serveur && (
            <Input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={recherche} aria-label={recherche} className="w-72" maxLength={100} />
          )}
          {actionsSelection && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {selection.length ? compteSelection(selection.length) : "Cochez des lignes pour agir dessus."}
              </span>
              {actionsSelection(selection, () => setRowSelection({}))}
            </div>
          )}
        </div>
      )}
      <Table aria-label={libelle}>
        <TableHeader>
          {table.getHeaderGroups().map((groupe) => (
            <TableRow key={groupe.id}>
              {groupe.headers.map((h) => (
                <TableHead key={h.id} aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>
                  {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {lignes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={nbColonnes} className="py-10 text-center text-muted-foreground">
                {filtre ? "Aucune ligne ne correspond à cette recherche." : vide}
              </TableCell>
            </TableRow>
          ) : (
            lignes.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined} className={ligneClassName?.(row.original)}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!sansPagination && pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between px-2 text-sm text-muted-foreground">
          <span>
            Page {page} sur {pages} · {total} ligne{total > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => (serveur ? naviguer({ page: String(page - 1) }) : table.previousPage())}>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => (serveur ? naviguer({ page: String(page + 1) }) : table.nextPage())}>
              Suivant
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

/** En-tête triable : clic pour trier, la flèche indique le sens. */
export function EnTete<TData extends RowData, TValue>({ ctx, titre, align = "left" }: { ctx: HeaderContext<DataTableFeatures, TData, TValue>; titre: string; align?: "left" | "right" }) {
  const col = ctx.column;
  if (!col.getCanSort()) return <span className={cn("block", align === "right" && "text-right")}>{titre}</span>;
  const sens = col.getIsSorted();
  const Icone = sens === "asc" ? ArrowUp : sens === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={col.getToggleSortingHandler()}
      className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", align === "right" && "ml-auto flex")}
    >
      {titre}
      <Icone className={cn("size-3.5", !sens && "opacity-40")} aria-hidden />
    </button>
  );
}

/** Colonne de cases à cocher (sélection de lignes pour une action groupée). */
export function colonneSelection<TData extends RowData>(libelleLigne: (row: TData) => string): Colonnes<TData>[number] {
  return {
    id: "selection",
    enableSorting: false,
    enableGlobalFilter: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        className="size-4 accent-primary"
        aria-label="Tout sélectionner sur cette page"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = !table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }: CellContext<DataTableFeatures, TData, unknown>) => (
      <input type="checkbox" className="size-4 accent-primary" aria-label={`Sélectionner ${libelleLigne(row.original)}`} checked={row.getIsSelected()} disabled={!row.getCanSelect()} onChange={row.getToggleSelectedHandler()} />
    ),
  };
}
