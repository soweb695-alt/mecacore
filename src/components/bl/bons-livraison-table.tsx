"use client";

import { Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BlRenvoyerButton, BlStatutButton } from "@/components/bl/pret-button";
import { colonneSelection, DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { LABELS, StatusBadge, type Tone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FacturerDialog } from "@/components/factures/facturer-dialog";
import { api } from "@/lib/client-api";
import { dateFR } from "@/lib/format";

export interface BlRow {
  id: string;
  numero: string;
  clientId: string | null;
  clientNom: string;
  clientEmail: string | null;
  devis: { id: string; numero: string } | null;
  facture: { id: string; numero: string } | null;
  pieces: string;
  /** ISO */
  date: string;
  statut: "EN_ATTENTE" | "PRETE" | "LIVREE";
}

const TONE: Record<BlRow["statut"], Tone> = { EN_ATTENTE: "neutral", PRETE: "warn", LIVREE: "ok" };
const facturable = (r: BlRow) => r.statut === "LIVREE" && !r.facture && !!r.clientId;

function colonnesBl({ peutModifier, peutFacturer }: { peutModifier: boolean; peutFacturer: boolean }): Colonnes<BlRow> {
  return [
    ...(peutFacturer ? [colonneSelection<BlRow>((r) => r.numero)] : []),
    {
      accessorKey: "numero",
      header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.numero}
          {row.original.devis && (
            <Link href={`/devis/${row.original.devis.id}`} className="ml-2 text-xs font-normal text-link hover:underline">
              {row.original.devis.numero}
            </Link>
          )}
        </span>
      ),
    },
    { accessorKey: "clientNom", header: (ctx) => <EnTete ctx={ctx} titre="Client" /> },
    { accessorKey: "pieces", enableSorting: false, header: "Pièces", cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.pieces}</span> },
    { accessorKey: "date", header: (ctx) => <EnTete ctx={ctx} titre="Date" />, cell: ({ row }) => dateFR(row.original.date) },
    {
      accessorKey: "statut",
      header: (ctx) => <EnTete ctx={ctx} titre="Statut" />,
      cell: ({ row }) => (
        <>
          <StatusBadge tone={TONE[row.original.statut]}>{LABELS.statutBL[row.original.statut]}</StatusBadge>
          {row.original.facture && (
            <Link href={`/factures/${row.original.facture.id}`} className="ml-2 text-xs text-link hover:underline">
              {row.original.facture.numero}
            </Link>
          )}
        </>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableGlobalFilter: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <a href={`/api/bons-livraison/${r.id}/pdf`} target="_blank" rel="noopener" className="text-xs text-link hover:underline">
              PDF
            </a>
            {peutModifier && r.statut === "LIVREE" && <BlRenvoyerButton id={r.id} numero={r.numero} client={r.clientNom} email={r.clientEmail} />}
            {peutModifier && r.statut === "EN_ATTENTE" && <BlStatutButton id={r.id} action="prete" />}
            {peutModifier && r.statut === "PRETE" && <BlStatutButton id={r.id} action="livre" />}
          </div>
        );
      },
    },
  ];
}

/** Bons de livraison : seuls les bons livrés et non facturés sont cochables (facturation groupée d'un même client). */
export function BonsLivraisonTable({ rows, peutModifier, peutFacturer }: { rows: BlRow[]; peutModifier: boolean; peutFacturer: boolean }) {
  const router = useRouter();
  const [aFacturer, setAFacturer] = useState<string[] | null>(null);
  const columns = useMemo(() => colonnesBl({ peutModifier, peutFacturer }), [peutModifier, peutFacturer]);

  function ouvrirFacturation(ids: string[]) {
    const choisis = rows.filter((r) => ids.includes(r.id));
    if (new Set(choisis.map((r) => r.clientId)).size > 1) return void toast.error("Sélectionnez des bons de livraison d'un même client.");
    setAFacturer(ids);
  }

  return (
    <div>
      <FacturerDialog
        ouvert={aFacturer !== null}
        onClose={() => setAFacturer(null)}
        heriterSiVide
        description="Une facture unique regroupe les bons sélectionnés. Laissez la remise vide pour reprendre celles des devis ; le mode de règlement se règle avant l'émission."
        onConfirm={async (options) => {
          const f = await api<{ id: string; numero: string }>("/api/factures/bons-livraison", "POST", { bonLivraisonIds: aFacturer ?? [], ...options });
          toast.success(`Facture ${f.numero} créée`);
          router.push(`/factures/${f.id}`);
        }}
      />
      <DataTable
        libelle="Bons de livraison"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        recherche="Filtrer par n°, client, pièce…"
        vide="Aucun bon de livraison. Ils sont créés à la validation d'un devis de pièces, ou avec « Nouveau »."
        ligneSelectionnable={facturable}
        aideSelection="Cochez des bons « Livré » d'un même client pour les regrouper en une facture."
        compteSelection={(n) => `${n} bon${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}`}
        actionsSelection={
          peutFacturer
            ? (ids) => (
                <Button size="sm" disabled={ids.length === 0} onClick={() => ouvrirFacturation(ids)}>
                  <Receipt aria-hidden />
                  Transformer en facture
                </Button>
              )
            : undefined
        }
      />
    </div>
  );
}
