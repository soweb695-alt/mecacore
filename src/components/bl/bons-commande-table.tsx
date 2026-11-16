"use client";

import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { BonCommandeForm, ReceptionForm } from "@/components/bl/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/forms/form-dialog";
import { LABELS, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateFR } from "@/lib/format";

export interface BcRow {
  id: string;
  numero: string;
  automatique: boolean;
  fournisseur: string;
  /** ISO */
  date: string;
  statut: keyof typeof LABELS.statutBC;
  lignes: { id: string; pieceId: string; reference: string; nom: string; quantite: number; quantiteRecue: number }[];
}

function colonnesBc(edit: boolean): Colonnes<BcRow> {
  return [
    {
      accessorKey: "numero",
      header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.numero}
          {row.original.automatique && (
            <StatusBadge tone="warn" className="ml-2">
              Automatique
            </StatusBadge>
          )}
        </span>
      ),
    },
    { accessorKey: "fournisseur", header: (ctx) => <EnTete ctx={ctx} titre="Fournisseur" /> },
    {
      id: "pieces",
      accessorFn: (b) => b.lignes.map((l) => `${l.reference} × ${l.quantite}`).join(", "),
      enableSorting: false,
      header: "Pièces",
      cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue<string>()}</span>,
    },
    { accessorKey: "date", header: (ctx) => <EnTete ctx={ctx} titre="Date" />, cell: ({ row }) => dateFR(row.original.date) },
    {
      accessorKey: "statut",
      header: (ctx) => <EnTete ctx={ctx} titre="Statut" />,
      cell: ({ row }) => <StatusBadge tone={row.original.statut === "RECEPTIONNEE" ? "ok" : row.original.statut === "RECEPTIONNEE_PARTIELLE" ? "warn" : "neutral"}>{LABELS.statutBC[row.original.statut]}</StatusBadge>,
    },
    {
      id: "actions",
      enableSorting: false,
      enableGlobalFilter: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const b = row.original;
        if (!edit) return null;
        return (
          <div className="flex justify-end gap-1.5">
            {b.statut === "EN_ATTENTE" && b.lignes.every((l) => l.quantiteRecue === 0) && (
              <>
                <FormDialog title={`Modifier ${b.numero}`} trigger={<Button size="sm" variant="outline">Modifier</Button>}>
                  <BonCommandeForm bc={{ id: b.id, fournisseur: b.fournisseur, lignes: b.lignes.map((l) => ({ pieceId: l.pieceId, libelle: `${l.reference} · ${l.nom}`, quantite: l.quantite })) }} />
                </FormDialog>
                <ConfirmButton label="" title="Supprimer ce bon de commande ?" description="Le bon n'a pas été réceptionné : il sera supprimé définitivement." url={`/api/bons-commande/${b.id}`} success="Bon de commande supprimé" variant="destructive" size="sm">
                  <Trash2 aria-label={`Supprimer ${b.numero}`} />
                </ConfirmButton>
              </>
            )}
            {b.statut !== "RECEPTIONNEE" && (
              <FormDialog title={`Réception ${b.numero}`} trigger={<Button size="sm">Réceptionner</Button>}>
                <ReceptionForm bonCommandeId={b.id} lignes={b.lignes.map((l) => ({ id: l.id, libelle: `${l.reference} · ${l.nom}`, commande: l.quantite, recue: l.quantiteRecue }))} />
              </FormDialog>
            )}
          </div>
        );
      },
    },
  ];
}

export function BonsCommandeTable({ rows, edit }: { rows: BcRow[]; edit: boolean }) {
  const columns = useMemo(() => colonnesBc(edit), [edit]);
  return <DataTable libelle="Bons de commande" columns={columns} data={rows} getRowId={(b) => b.id} recherche="Filtrer par n°, fournisseur, référence…" vide="Aucun bon de commande. Créez-en un avec « Nouveau » ; ils sont aussi créés quand une pièce atteint son seuil d'alerte." />;
}
