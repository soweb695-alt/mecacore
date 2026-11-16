"use client";

import { Pencil } from "lucide-react";
import { CollaborateurForm } from "@/components/collaborateurs/collaborateur-form";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/forms/form-dialog";
import { LABELS, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

export interface CollaborateurRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: keyof typeof LABELS.role;
  isActive: boolean;
  couleur: string | null;
  /** Couleur effective (planning). */
  couleurAffichee: string;
}

const colonnes: Colonnes<CollaborateurRow> = [
  {
    id: "nom",
    accessorFn: (u) => `${u.firstName} ${u.lastName}`,
    header: (ctx) => <EnTete ctx={ctx} titre="Collaborateur" />,
    cell: ({ row, getValue }) => (
      <span className="font-medium">
        {/* Pastille : couleur du collaborateur dans le planning. */}
        <span className="mr-2 inline-block size-2.5 rounded-[2px]" style={{ background: row.original.couleurAffichee }} aria-hidden />
        {getValue<string>()}
      </span>
    ),
  },
  { accessorKey: "email", header: (ctx) => <EnTete ctx={ctx} titre="E-mail" /> },
  { accessorKey: "role", header: (ctx) => <EnTete ctx={ctx} titre="Rôle" />, cell: ({ row }) => LABELS.role[row.original.role] },
  { accessorKey: "isActive", header: (ctx) => <EnTete ctx={ctx} titre="Statut" />, cell: ({ row }) => <StatusBadge tone={row.original.isActive ? "ok" : "neutral"}>{row.original.isActive ? "Actif" : "Désactivé"}</StatusBadge> },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const { couleurAffichee: _c, ...u } = row.original;
      void _c;
      return (
        <FormDialog
          title="Modifier le collaborateur"
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${u.firstName} ${u.lastName}`}>
              <Pencil aria-hidden />
            </Button>
          }
        >
          <CollaborateurForm user={u} />
        </FormDialog>
      );
    },
  },
];

export function CollaborateursTable({ rows }: { rows: CollaborateurRow[] }) {
  return <DataTable libelle="Collaborateurs" columns={colonnes} data={rows} getRowId={(u) => u.id} vide="Aucun collaborateur." />;
}
