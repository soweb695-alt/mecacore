"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";

type Mode = "" | "CB" | "ESPECES" | "CHEQUE" | "VIREMENT" | "PLUSIEURS_FOIS";

/** Mode de règlement prévu de la facture : « Virement » fait apparaître l'IBAN / BIC sur le PDF. */
export function ModePaiementSelect({ factureId, valeur, modifiable }: { factureId: string; valeur: Mode; modifiable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(valeur);
  return (
    <NativeSelect
      aria-label="Mode de règlement prévu"
      value={mode}
      disabled={!modifiable}
      onChange={async (e) => {
        const avant = mode;
        const v = e.target.value as Mode;
        setMode(v);
        try {
          await api(`/api/factures/${factureId}`, "PATCH", { modePaiement: v || null });
          toast.success(v === "VIREMENT" ? "Les coordonnées bancaires figureront sur le PDF" : "Mode de règlement enregistré");
          router.refresh();
        } catch (err) {
          setMode(avant);
          toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
        }
      }}
    >
      <option value="">Non précisé</option>
      <option value="CB">Carte bancaire</option>
      <option value="ESPECES">Espèces</option>
      <option value="CHEQUE">Chèque</option>
      <option value="VIREMENT">Virement</option>
      <option value="PLUSIEURS_FOIS">Paiement en plusieurs fois</option>
    </NativeSelect>
  );
}
