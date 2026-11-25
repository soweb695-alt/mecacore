"use client";

import { FileText, X } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * Descriptif d'une ligne de devis ou de facture : pré-rempli depuis le tarif (forfait vidange…), modifiable pour ce
 * document uniquement, imprimé sous la désignation sur le PDF. Replié par défaut quand il est vide.
 */
export function DescriptifLigne({ valeur, onChange, designation }: { valeur: string; onChange: (v: string) => void; designation: string }) {
  const [ouvert, setOuvert] = useState(valeur.trim() !== "");
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        <FileText className="size-3" aria-hidden />
        Ajouter un descriptif
      </button>
    );
  }
  return (
    <div className="relative mt-1">
      <Textarea
        aria-label={`Descriptif de ${designation || "la ligne"}`}
        value={valeur}
        maxLength={1500}
        rows={Math.min(6, Math.max(2, valeur.split("\n").length + Math.floor(valeur.length / 70)))}
        placeholder="Détail des travaux, conditions, remarques… (imprimé sous la ligne)"
        className="min-h-0 pr-7 text-xs"
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        aria-label="Retirer le descriptif"
        title="Retirer le descriptif"
        className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
        onClick={() => {
          onChange("");
          setOuvert(false);
        }}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
