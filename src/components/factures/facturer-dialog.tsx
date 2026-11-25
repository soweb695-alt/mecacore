"use client";

import { Eye, Loader2, Receipt, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { apercu, OptionsFactureFields, optionsInitiales, payloadOptions, type OptionsFactureState } from "@/components/factures/options-facture";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Totaux } from "@/lib/money";

/**
 * Fenêtre « Créer la facture » : remise globale et mode de règlement, puis au choix « Enregistrer en brouillon »
 * (modifiable, sans numéro), « Aperçu PDF » (brouillon + PDF filigrané) ou « Émettre la facture ».
 * Une facture émise n'est plus modifiable : il faut l'annuler et la refaire.
 */
export function FacturerDialog({
  ouvert,
  onClose,
  description,
  totaux,
  initial = optionsInitiales,
  heriterSiVide = false,
  onConfirm,
}: {
  ouvert: boolean;
  onClose: () => void;
  description: string;
  totaux?: Totaux;
  /** Remise pré-remplie (celle du devis). */
  initial?: OptionsFactureState;
  /** Remise laissée vide = reprendre les remises des devis (facture groupée de bons de livraison). */
  heriterSiVide?: boolean;
  /** Crée la facture (émise, ou brouillon si `brouillon`) et renvoie son id et son numéro (null pour un brouillon). */
  onConfirm: (options: ReturnType<typeof payloadOptions> & { brouillon: boolean }) => Promise<{ id: string; numero: string | null }>;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<OptionsFactureState>(initial);
  const [pending, setPending] = useState(false);
  const invalide = totaux ? apercu(totaux, options).erreur !== null : Number(options.valeur) < 0 || (options.type === "POURCENT" && Number(options.valeur) >= 100);

  async function confirmer(action: "brouillon" | "apercu" | "emettre") {
    // Fenêtre ouverte au clic : sinon le navigateur bloque l'ouverture après l'enregistrement.
    const fenetre = action === "apercu" ? window.open("about:blank", "_blank") : null;
    setPending(true);
    try {
      const f = await onConfirm({ ...payloadOptions(options, heriterSiVide), brouillon: action !== "emettre" });
      if (action === "apercu") {
        const url = `/api/factures/${f.id}/pdf`;
        if (fenetre) fenetre.location.href = url;
        else window.open(url, "_blank");
      }
      toast.success(action === "emettre" ? `Facture ${f.numero} émise` : "Brouillon enregistré : vous pouvez le modifier, le prévisualiser puis l'émettre.");
      router.push(`/factures/${f.id}`);
    } catch (e) {
      fenetre?.close();
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
        <DialogFooter className="flex-wrap">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button variant="outline" onClick={() => confirmer("brouillon")} disabled={pending || invalide}>
            <Save aria-hidden />
            Enregistrer en brouillon
          </Button>
          <Button variant="outline" onClick={() => confirmer("apercu")} disabled={pending || invalide}>
            <Eye aria-hidden />
            Aperçu PDF
          </Button>
          <Button onClick={() => confirmer("emettre")} disabled={pending || invalide}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Receipt aria-hidden />}
            Émettre la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
