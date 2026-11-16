"use client";

import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type PaginationServeur } from "@/components/data-table/data-table";
import { colonnesFactures, type FactureRow } from "@/components/factures/columns";
import { Button } from "@/components/ui/button";

export type { FactureRow };

/** Liste des factures (paginée et triée par le serveur), sélection et export en Excel ou en PDF groupé. */
export function FacturesTable({ rows, peutExporter, serveur }: { rows: FactureRow[]; peutExporter: boolean; serveur: PaginationServeur }) {
  const [export_, setExport] = useState<"xlsx" | "pdf" | null>(null);
  const columns = useMemo(() => colonnesFactures(peutExporter), [peutExporter]);

  async function exporter(ids: string[], format: "xlsx" | "pdf") {
    setExport(format);
    try {
      const res = await fetch("/api/factures/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, format }), credentials: "same-origin" });
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
    <DataTable
      libelle="Factures"
      columns={columns}
      data={rows}
      getRowId={(f) => f.id}
      serveur={serveur}
      compteSelection={(n) => `${n} facture${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`}
      vide="Aucune facture. Créez-en une avec « Nouvelle facture » ou depuis un devis validé."
      actionsSelection={
        peutExporter
          ? (ids) => (
              <>
                <Button variant="outline" size="sm" disabled={!ids.length || !!export_} onClick={() => exporter(ids, "xlsx")}>
                  {export_ === "xlsx" ? <Loader2 className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />}
                  Exporter la sélection (Excel)
                </Button>
                <Button variant="outline" size="sm" disabled={!ids.length || !!export_} onClick={() => exporter(ids, "pdf")}>
                  {export_ === "pdf" ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
                  PDF groupé
                </Button>
              </>
            )
          : undefined
      }
    />
  );
}
