"use client";

import { Loader2, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { apercu, OptionsFactureFields, optionsInitiales, payloadOptions, type OptionsFactureState } from "@/components/factures/options-facture";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Totaux } from "@/lib/money";

/**
 * Fenêtre « Créer la facture » : remise globale et mode de règlement se règlent avant l'émission
 * (une facture émise n'est plus modifiable : il faut l'annuler et la refaire).
 */
export function FacturerDialog({
  ouvert,
  onClose,
  description,
  totaux,
  onConfirm,
}: {
  ouvert: boolean;
  onClose: () => void;
  description: string;
  totaux?: Totaux;
  onConfirm: (options: ReturnType<typeof payloadOptions>) => Promise<void>;
}) {
  const [options, setOptions] = useState<OptionsFactureState>(optionsInitiales);
  const [pending, setPending] = useState(false);
  const invalide = totaux ? apercu(totaux, options).erreur !== null : Number(options.valeur) < 0 || (options.type === "POURCENT" && Number(options.valeur) >= 100);

  async function confirmer() {
    setPending(true);
    try {
      await onConfirm(payloadOptions(options));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer la facture</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <OptionsFactureFields value={options} onChange={setOptions} totaux={totaux} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={confirmer} disabled={pending || invalide}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Receipt aria-hidden />}
            Émettre la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
