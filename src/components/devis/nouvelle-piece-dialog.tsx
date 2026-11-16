"use client";

import { toast } from "sonner";
import { PieceForm, type PieceEnregistree } from "@/components/stock/piece-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Pièce renvoyée par l'API du stock après création. */
export type PieceCreee = PieceEnregistree;

/**
 * Création d'une pièce depuis l'éditeur de devis, avec le même formulaire que le Stock
 * (prix HT / TTC / marge synchronisés, seuil et alerte) : enregistrée dans le stock, puis ajoutée au devis en cours.
 * Le prix d'achat n'est demandé qu'aux rôles qui le voient (administrateur, Magasin).
 */
export function NouvellePieceDialog({ open, onOpenChange, voirAchat, voirMarge = false, onCreee }: { open: boolean; onOpenChange: (o: boolean) => void; voirAchat: boolean; voirMarge?: boolean; onCreee: (p: PieceCreee) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle pièce</DialogTitle>
          <DialogDescription>La pièce est enregistrée dans le stock puis ajoutée au devis.</DialogDescription>
        </DialogHeader>
        {/* Formulaire monté à chaque ouverture : il repart vide. */}
        {open && (
          <PieceForm
            voirAchat={voirAchat}
            voirMarge={voirMarge}
            libelleCreer="Créer et ajouter au devis"
            onCancel={() => onOpenChange(false)}
            onSaved={(p) => {
              toast.success(`Pièce ${p.reference} créée et ajoutée au devis`);
              onCreee(p);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
