"use client";

import { Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BlRenvoyerButton, BlStatutButton } from "@/components/bl/pret-button";
import { LABELS, StatusBadge, type Tone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FacturerDialog } from "@/components/factures/facturer-dialog";
import { api } from "@/lib/client-api";

export interface BlRow {
  id: string;
  numero: string;
  clientId: string | null;
  clientNom: string;
  devis: { id: string; numero: string } | null;
  facture: { id: string; numero: string } | null;
  pieces: string;
  date: string;
  statut: "EN_ATTENTE" | "PRETE" | "LIVREE";
}

const TONE: Record<BlRow["statut"], Tone> = { EN_ATTENTE: "neutral", PRETE: "warn", LIVREE: "ok" };

/** Liste des bons de livraison avec cases à cocher : seuls les bons livrés et non facturés sont sélectionnables. */
export function BonsLivraisonTable({ rows, peutModifier, peutFacturer }: { rows: BlRow[]; peutModifier: boolean; peutFacturer: boolean }) {
  const router = useRouter();
  const [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState(false);
  const facturable = (r: BlRow) => r.statut === "LIVREE" && !r.facture && !!r.clientId;

  function basculer(r: BlRow) {
    setSelection((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]));
  }

  function ouvrirFacturation() {
    const choisis = rows.filter((r) => selection.includes(r.id));
    if (new Set(choisis.map((r) => r.clientId)).size > 1) {
      toast.error("Sélectionnez des bons de livraison d'un même client.");
      return;
    }
    setDialog(true);
  }

  return (
    <div>
      <FacturerDialog
        ouvert={dialog}
        onClose={() => setDialog(false)}
        description="Une facture unique regroupe les bons sélectionnés. Remise globale et mode de règlement se règlent avant l'émission."
        onConfirm={async (options) => {
          const f = await api<{ id: string; numero: string }>("/api/factures/bons-livraison", "POST", { bonLivraisonIds: selection, ...options });
          toast.success(`Facture ${f.numero} créée`);
          router.push(`/factures/${f.id}`);
        }}
      />
      {peutFacturer && (
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {selection.length > 0 ? `${selection.length} bon${selection.length > 1 ? "s" : ""} sélectionné${selection.length > 1 ? "s" : ""}` : "Cochez des bons « Livré » d'un même client pour les regrouper en une facture."}
          </span>
          <Button size="sm" disabled={selection.length === 0} onClick={ouvrirFacturation}>
            <Receipt aria-hidden />
            Transformer en facture
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {peutFacturer && <TableHead className="w-8" />}
            <TableHead>N°</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Pièces</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-64" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={peutFacturer ? 7 : 6} className="py-8 text-center text-muted-foreground">
                Aucun bon de livraison.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              {peutFacturer && (
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    aria-label={`Sélectionner ${r.numero}`}
                    disabled={!facturable(r)}
                    title={facturable(r) ? undefined : r.facture ? "Déjà facturé" : "Seuls les bons « Livré » peuvent être facturés"}
                    checked={selection.includes(r.id)}
                    onChange={() => basculer(r)}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium">
                {r.numero}
                {r.devis && (
                  <Link href={`/devis/${r.devis.id}`} className="ml-2 text-xs font-normal text-link hover:underline">
                    {r.devis.numero}
                  </Link>
                )}
              </TableCell>
              <TableCell>{r.clientNom}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.pieces}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>
                <StatusBadge tone={TONE[r.statut]}>{LABELS.statutBL[r.statut]}</StatusBadge>
                {r.facture && (
                  <Link href={`/factures/${r.facture.id}`} className="ml-2 text-xs text-link hover:underline">
                    {r.facture.numero}
                  </Link>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <a href={`/api/bons-livraison/${r.id}/pdf`} target="_blank" rel="noopener" className="text-xs text-link hover:underline">
                    PDF
                  </a>
                  {peutModifier && r.statut === "LIVREE" && <BlRenvoyerButton id={r.id} />}
                  {peutModifier && r.statut === "EN_ATTENTE" && <BlStatutButton id={r.id} action="prete" />}
                  {peutModifier && r.statut === "PRETE" && <BlStatutButton id={r.id} action="livre" />}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
