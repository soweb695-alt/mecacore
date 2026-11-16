"use client";

import { Pencil, Send, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { CampagneForm } from "@/components/campagnes/campagne-form";
import { ConfirmButton } from "@/components/confirm-button";
import { DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { FormDialog } from "@/components/forms/form-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateFR } from "@/lib/format";

type Audience = "TOUS" | "PARTICULIER" | "PRO";

export interface CampagneRow {
  id: string;
  nom: string;
  sujet: string;
  contenu: string;
  audience: Audience;
  audienceLibelle: string;
  envoyeeLe: string | null;
  nbEnvoyes: number;
  nbDestinataires: number;
  nbEchecs: number;
}

interface Droits {
  edition: boolean;
  suppression: boolean;
  compteurs: Record<Audience, number>;
}

function colonnesCampagnes({ edition, suppression, compteurs }: Droits): Colonnes<CampagneRow> {
  return [
    {
      accessorKey: "nom",
      header: (ctx) => <EnTete ctx={ctx} titre="Campagne" />,
      cell: ({ row }) => (
        <>
          <div className="font-medium">{row.original.nom}</div>
          <div className="text-xs text-muted-foreground">{row.original.sujet}</div>
        </>
      ),
    },
    { accessorKey: "audienceLibelle", header: (ctx) => <EnTete ctx={ctx} titre="Destinataires" /> },
    {
      accessorKey: "envoyeeLe",
      sortUndefined: "first",
      header: (ctx) => <EnTete ctx={ctx} titre="Statut" />,
      cell: ({ row }) => {
        const c = row.original;
        const partielle = !!c.envoyeeLe && c.nbEchecs > 0;
        return <StatusBadge tone={partielle ? "warn" : c.envoyeeLe ? "ok" : "neutral"}>{partielle ? "Envoi incomplet" : c.envoyeeLe ? `Envoyée le ${dateFR(c.envoyeeLe)}` : "Brouillon"}</StatusBadge>;
      },
    },
    { accessorKey: "nbEnvoyes", header: (ctx) => <EnTete ctx={ctx} titre="Envoyés" align="right" />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.envoyeeLe ? `${row.original.nbEnvoyes} / ${row.original.nbDestinataires}` : "–"}</div> },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const c = row.original;
        const envoyee = !!c.envoyeeLe;
        const partielle = envoyee && c.nbEchecs > 0;
        return (
          <div className="flex justify-end gap-1.5">
            {(!envoyee || partielle) && edition && (
              <ConfirmButton
                label={partielle ? "Relancer les échecs" : "Envoyer"}
                title={partielle ? "Relancer l'envoi ?" : "Envoyer cette campagne ?"}
                description={
                  partielle
                    ? `${c.nbEchecs} envoi(s) ont échoué : seuls ces clients seront relancés, les autres ne recevront rien de plus.`
                    : `L'e-mail « ${c.sujet} » sera envoyé à ${compteurs[c.audience] ?? 0} client(s) ayant accepté de recevoir des offres. Cette action est définitive.`
                }
                url={`/api/campagnes/${c.id}/envoyer`}
                method="POST"
                success="Campagne envoyée"
                variant="default"
                size="sm"
              >
                <Send aria-hidden />
              </ConfirmButton>
            )}
            {!envoyee && edition && (
              <FormDialog
                title="Modifier la campagne"
                wide
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil aria-hidden />
                    Modifier
                  </Button>
                }
              >
                <CampagneForm compteurs={compteurs} campagne={{ id: c.id, nom: c.nom, audience: c.audience, sujet: c.sujet, contenu: c.contenu }} />
              </FormDialog>
            )}
            {!envoyee && suppression && (
              <ConfirmButton label="" title="Supprimer cette campagne ?" description="La campagne non envoyée sera supprimée définitivement." url={`/api/campagnes/${c.id}`} success="Campagne supprimée" variant="destructive" size="sm">
                <Trash2 aria-label={`Supprimer ${c.nom}`} />
              </ConfirmButton>
            )}
          </div>
        );
      },
    },
  ];
}

export function CampagnesTable({ rows, ...droits }: { rows: CampagneRow[] } & Droits) {
  const { edition, suppression, compteurs } = droits;
  const columns = useMemo(() => colonnesCampagnes({ edition, suppression, compteurs }), [edition, suppression, compteurs]);
  return <DataTable libelle="Campagnes" columns={columns} data={rows} getRowId={(c) => c.id} vide="Aucune campagne. Créez une promotion avec « Nouvelle campagne »." />;
}
