"use client";

import { FileDown, Mail, MoreHorizontal, PackageCheck, Receipt, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { avancerBl, BlRenvoyerButton, BlStatutButton, EnvoiBlDialog } from "@/components/bl/pret-button";
import { colonneSelection, DataTable, EnTete } from "@/components/data-table/data-table";
import type { Colonnes } from "@/components/data-table/data-table-features";
import { LABELS, StatusBadge, type Tone } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  pieces: { designation: string; quantite: number }[];
  /** ISO */
  date: string;
  statut: "EN_ATTENTE" | "PRETE" | "LIVREE";
}

const TONE: Record<BlRow["statut"], Tone> = { EN_ATTENTE: "neutral", PRETE: "warn", LIVREE: "ok" };
const facturable = (r: BlRow) => r.statut === "LIVREE" && !r.facture && !!r.clientId;
const texteLigne = (p: BlRow["pieces"][number]) => `${p.designation} × ${p.quantite}`;
const textePieces = (r: BlRow) => r.pieces.map(texteLigne).join(", ");

/** Pièces résumées sur une ligne : la première, puis « +N » ; la liste complète au survol. */
function PiecesResume({ pieces }: { pieces: BlRow["pieces"] }) {
  if (pieces.length === 0) return <span className="text-sm text-muted-foreground">–</span>;
  return (
    <span className="flex max-w-64 items-center gap-1.5 text-sm text-muted-foreground" title={pieces.map(texteLigne).join("\n")}>
      <span className="truncate">{texteLigne(pieces[0])}</span>
      {pieces.length > 1 && <span className="shrink-0 rounded bg-muted px-1.5 text-xs font-medium text-foreground">+{pieces.length - 1}</span>}
    </span>
  );
}

type Actions = { peutModifier: boolean; envoyer: (r: BlRow) => void; avancer: (r: BlRow, action: "prete" | "livre") => void };

/** Menu « ⋯ » d'un bon (ordinateur) : PDF, étape suivante, envoi au client. */
function MenuActions({ r, peutModifier, envoyer, avancer }: Actions & { r: BlRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Actions ${r.numero}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        <DropdownMenuItem onClick={() => window.open(`/api/bons-livraison/${r.id}/pdf`, "_blank", "noopener")}>
          <FileDown aria-hidden />
          Ouvrir le PDF
        </DropdownMenuItem>
        {peutModifier && r.statut === "EN_ATTENTE" && (
          <DropdownMenuItem onClick={() => avancer(r, "prete")}>
            <PackageCheck aria-hidden />
            Prêt à être retiré
          </DropdownMenuItem>
        )}
        {peutModifier && r.statut === "PRETE" && (
          <DropdownMenuItem onClick={() => avancer(r, "livre")}>
            <Truck aria-hidden />
            Marquer livré
          </DropdownMenuItem>
        )}
        {peutModifier && r.statut === "LIVREE" && (
          <DropdownMenuItem onClick={() => envoyer(r)}>
            <Mail aria-hidden />
            Envoyer le BL
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function colonnesBl({ peutFacturer, ...actions }: Actions & { peutFacturer: boolean }): Colonnes<BlRow> {
  return [
    ...(peutFacturer ? [colonneSelection<BlRow>((r) => r.numero)] : []),
    {
      accessorKey: "numero",
      header: (ctx) => <EnTete ctx={ctx} titre="N°" />,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <span className="font-medium">{row.original.numero}</span>
          {row.original.devis && (
            <Link href={`/devis/${row.original.devis.id}`} className="block text-xs text-link hover:underline">
              {row.original.devis.numero}
            </Link>
          )}
        </div>
      ),
    },
    { accessorKey: "clientNom", header: (ctx) => <EnTete ctx={ctx} titre="Client" />, cell: ({ row }) => <span className="block max-w-48 truncate" title={row.original.clientNom}>{row.original.clientNom}</span> },
    { id: "pieces", accessorFn: textePieces, enableSorting: false, header: "Pièces", cell: ({ row }) => <PiecesResume pieces={row.original.pieces} /> },
    { accessorKey: "date", header: (ctx) => <EnTete ctx={ctx} titre="Date" />, cell: ({ row }) => <span className="whitespace-nowrap">{dateFR(row.original.date)}</span> },
    {
      accessorKey: "statut",
      header: (ctx) => <EnTete ctx={ctx} titre="Statut" />,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <StatusBadge tone={TONE[row.original.statut]}>{LABELS.statutBL[row.original.statut]}</StatusBadge>
          {row.original.facture && (
            <Link href={`/factures/${row.original.facture.id}`} className="block text-xs text-link hover:underline">
              {row.original.facture.numero}
            </Link>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableGlobalFilter: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <MenuActions r={row.original} {...actions} />
        </div>
      ),
    },
  ];
}

/** Carte d'un bon (tablette, téléphone) : tout est lisible sans défilement, boutons directement accessibles. */
function CarteBl({ r, caseSelection, peutModifier }: { r: BlRow; caseSelection: ((l: string) => ReactNode) | null; peutModifier: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {caseSelection?.(r.numero)}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{r.numero}</span>
            <StatusBadge tone={TONE[r.statut]}>{LABELS.statutBL[r.statut]}</StatusBadge>
          </div>
          <p className="truncate text-sm">{r.clientNom}</p>
          <p className="text-xs text-muted-foreground">
            {dateFR(r.date)}
            {r.devis && (
              <>
                {" · "}
                <Link href={`/devis/${r.devis.id}`} className="text-link hover:underline">
                  {r.devis.numero}
                </Link>
              </>
            )}
            {r.facture && (
              <>
                {" · "}
                <Link href={`/factures/${r.facture.id}`} className="text-link hover:underline">
                  {r.facture.numero}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      {r.pieces.length > 0 && (
        <ul className="space-y-0.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground">
          {r.pieces.map((p, i) => (
            <li key={i} className="break-words">
              {texteLigne(p)}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <a href={`/api/bons-livraison/${r.id}/pdf`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <FileDown aria-hidden />
          PDF
        </a>
        {peutModifier && r.statut === "LIVREE" && <BlRenvoyerButton id={r.id} numero={r.numero} client={r.clientNom} email={r.clientEmail} />}
        {peutModifier && r.statut === "EN_ATTENTE" && <BlStatutButton id={r.id} action="prete" />}
        {peutModifier && r.statut === "PRETE" && <BlStatutButton id={r.id} action="livre" />}
      </div>
    </div>
  );
}

/** Bons de livraison : seuls les bons livrés et non facturés sont cochables (facturation groupée d'un même client). */
export function BonsLivraisonTable({ rows, peutModifier, peutFacturer }: { rows: BlRow[]; peutModifier: boolean; peutFacturer: boolean }) {
  const router = useRouter();
  const [aFacturer, setAFacturer] = useState<string[] | null>(null);
  const [aEnvoyer, setAEnvoyer] = useState<BlRow | null>(null);
  const columns = useMemo(
    () =>
      colonnesBl({
        peutModifier,
        peutFacturer,
        envoyer: setAEnvoyer,
        avancer: async (r, action) => {
          if (await avancerBl(r.id, action)) router.refresh();
        },
      }),
    [peutModifier, peutFacturer, router],
  );

  function ouvrirFacturation(ids: string[]) {
    const choisis = rows.filter((r) => ids.includes(r.id));
    if (new Set(choisis.map((r) => r.clientId)).size > 1) return void toast.error("Sélectionnez des bons de livraison d'un même client.");
    setAFacturer(ids);
  }

  return (
    <div>
      {aEnvoyer && <EnvoiBlDialog id={aEnvoyer.id} numero={aEnvoyer.numero} client={aEnvoyer.clientNom} email={aEnvoyer.clientEmail} open onOpenChange={(o) => !o && setAEnvoyer(null)} />}
      <FacturerDialog
        ouvert={aFacturer !== null}
        onClose={() => setAFacturer(null)}
        heriterSiVide
        description="Une facture unique regroupe les bons sélectionnés. Laissez la remise vide pour reprendre celles des devis ; le mode de règlement se règle avant l'émission."
        onConfirm={(options) => api<{ id: string; numero: string | null }>("/api/factures/bons-livraison", "POST", { bonLivraisonIds: aFacturer ?? [], ...options })}
      />
      <DataTable
        libelle="Bons de livraison"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        carte={(r, caseSelection) => <CarteBl r={r} caseSelection={caseSelection} peutModifier={peutModifier} />}
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
