"use client";

import { Receipt } from "lucide-react";
import { useState } from "react";
import { FacturerDialog } from "@/components/factures/facturer-dialog";
import { stateDepuisRemise } from "@/components/factures/options-facture";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import type { RemiseGlobale, Totaux } from "@/lib/money";

/** `totaux` : totaux du devis avant sa remise globale ; `remise` : remise du devis, pré-remplie et modifiable. */
export function CreerFactureButton({ devisId, totaux, remise = null }: { devisId: string; totaux: Totaux; remise?: RemiseGlobale | null }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Button onClick={() => setOuvert(true)}>
        <Receipt aria-hidden />
        Créer la facture
      </Button>
      <FacturerDialog
        ouvert={ouvert}
        onClose={() => setOuvert(false)}
        totaux={totaux}
        initial={stateDepuisRemise(remise)}
        description={remise ? "La remise du devis est reprise ; vous pouvez la modifier et indiquer le mode de règlement avant l'émission." : "Vous pouvez appliquer une remise globale et indiquer le mode de règlement avant l'émission."}
        onConfirm={(options) => api<{ id: string; numero: string | null }>("/api/factures", "POST", { devisId, ...options })}
      />
    </>
  );
}
