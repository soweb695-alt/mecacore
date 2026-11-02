"use client";

import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LABELS, StatusBadge, TONE_FACTURE } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FactureRow {
  id: string;
  numero: string | null;
  client: string;
  emission: string;
  echeance: string;
  statut: keyof typeof LABELS.statutFacture;
  totalTTC: string;
  reste: string | null;
}

/** Liste des factures avec sélection (cases à cocher) et export de la sélection en Excel ou en PDF groupé. */
export function FacturesTable({ rows, peutExporter }: { rows: FactureRow[]; peutExporter: boolean }) {
  const [selection, setSelection] = useState<string[]>([]);
  const [export_, setExport] = useState<"xlsx" | "pdf" | null>(null);
  const toutes = rows.length > 0 && rows.every((r) => selection.includes(r.id));
  const basculer = (id: string) => setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function exporter(format: "xlsx" | "pdf") {
    setExport(format);
    try {
      const res = await fetch("/api/factures/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selection, format }), credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Export impossible.");
      const nom = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `factures.${format}`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setExport(null);
    }
  }

  return (
    <>
      {peutExporter && (
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2 px-2 pt-1">
          <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">
            {selection.length ? `${selection.length} facture${selection.length > 1 ? "s" : ""} sélectionnée${selection.length > 1 ? "s" : ""}` : "Cochez des factures pour les exporter."}
          </span>
          <Button variant="outline" size="sm" disabled={!selection.length || !!export_} onClick={() => exporter("xlsx")}>
            {export_ === "xlsx" ? <Loader2 className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />}
            Exporter la sélection (Excel)
          </Button>
          <Button variant="outline" size="sm" disabled={!selection.length || !!export_} onClick={() => exporter("pdf")}>
            {export_ === "pdf" ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
            PDF groupé
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {peutExporter && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  aria-label="Tout sélectionner sur cette page"
                  checked={toutes}
                  onChange={() => setSelection(toutes ? [] : rows.map((r) => r.id))}
                />
              </TableHead>
            )}
            <TableHead>N°</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Émission</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total TTC</TableHead>
            <TableHead className="text-right">Reste dû</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={peutExporter ? 8 : 7} className="py-10 text-center text-muted-foreground">
                Aucune facture. Créez-en une avec « Nouvelle facture » ou depuis un devis validé.
              </TableCell>
            </TableRow>
          )}
          {rows.map((f) => (
            <TableRow key={f.id}>
              {peutExporter && (
                <TableCell>
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" aria-label={`Sélectionner ${f.numero ?? "le brouillon"}`} checked={selection.includes(f.id)} onChange={() => basculer(f.id)} />
                </TableCell>
              )}
              <TableCell className="font-medium">
                <Link href={`/factures/${f.id}`} className="hover:underline">
                  {f.numero ?? <span className="text-muted-foreground italic">Brouillon (à émettre)</span>}
                </Link>
              </TableCell>
              <TableCell>{f.client}</TableCell>
              <TableCell>{f.emission}</TableCell>
              <TableCell>{f.echeance}</TableCell>
              <TableCell>
                <StatusBadge tone={TONE_FACTURE[f.statut]}>{LABELS.statutFacture[f.statut]}</StatusBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{f.totalTTC}</TableCell>
              <TableCell className="text-right tabular-nums">{f.reste ?? "–"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
