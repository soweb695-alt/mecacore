"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { formatEUR, round2 } from "@/lib/money";
import { pieceCreationSchema } from "@/lib/validators/piece";

/** Pièce renvoyée par l'API du stock après création. */
export interface PieceCreee {
  id: string;
  reference: string;
  nom: string;
  prixVenteHT: number;
  prixAchatHT?: number;
  stock: number;
  seuilAlerte: number;
}

const VIDE = { reference: "", nom: "", prixAchatHT: "", prixVenteHT: "", stock: "0" };
const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

/**
 * Création rapide d'une pièce depuis l'éditeur de devis : enregistrée dans le stock, puis ajoutée au devis en cours.
 * Le prix d'achat n'est demandé qu'aux rôles qui le voient (administrateur, Magasin).
 */
export function NouvellePieceDialog({ open, onOpenChange, voirAchat, onCreee }: { open: boolean; onOpenChange: (o: boolean) => void; voirAchat: boolean; onCreee: (p: PieceCreee) => void }) {
  const [v, setV] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof VIDE) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  function fermer(o: boolean) {
    if (!o) {
      setV(VIDE);
      setErreurs({});
    }
    onOpenChange(o);
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      reference: v.reference,
      nom: v.nom,
      prixVenteHT: num(v.prixVenteHT),
      ...(voirAchat ? { prixAchatHT: v.prixAchatHT.trim() === "" ? 0 : num(v.prixAchatHT) } : {}),
      stock: num(v.stock),
      seuilAlerte: 0,
      referencesCroisees: [],
    };
    const parsed = pieceCreationSchema.safeParse(body);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.code === "invalid_type" ? "Nombre requis" : i.message;
      setErreurs(errs);
      return;
    }
    setErreurs({});
    setPending(true);
    try {
      const p = await api<PieceCreee>("/api/stock", "POST", parsed.data);
      toast.success(`Pièce ${p.reference} créée et ajoutée au devis`);
      onCreee(p);
      fermer(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const venteHT = num(v.prixVenteHT);

  return (
    <Dialog open={open} onOpenChange={fermer}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle pièce</DialogTitle>
          <DialogDescription>La pièce est enregistrée dans le stock puis ajoutée au devis. Les autres informations (marque, fournisseur, seuil…) se complètent ensuite depuis le Stock.</DialogDescription>
        </DialogHeader>
        <form onSubmit={creer} noValidate className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Référence" htmlFor="np-ref" error={erreurs.reference}>
              <Input id="np-ref" className="uppercase" value={v.reference} onChange={set("reference")} maxLength={60} aria-invalid={!!erreurs.reference} autoFocus />
            </Field>
            <Field label="Stock initial" htmlFor="np-stock" error={erreurs.stock}>
              <Input id="np-stock" type="number" min={0} step={1} value={v.stock} onChange={set("stock")} aria-invalid={!!erreurs.stock} />
            </Field>
          </div>
          <Field label="Nom" htmlFor="np-nom" error={erreurs.nom}>
            <Input id="np-nom" value={v.nom} onChange={set("nom")} maxLength={150} aria-invalid={!!erreurs.nom} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {voirAchat && (
              <Field label="Prix d'achat HT (€)" htmlFor="np-achat" error={erreurs.prixAchatHT}>
                <Input id="np-achat" inputMode="decimal" value={v.prixAchatHT} onChange={set("prixAchatHT")} aria-invalid={!!erreurs.prixAchatHT} />
              </Field>
            )}
            <Field
              label="Prix de vente HT (€)"
              htmlFor="np-vente"
              error={erreurs.prixVenteHT}
              hint={Number.isFinite(venteHT) && venteHT > 0 ? `Soit ${formatEUR(round2(venteHT * 1.2))} TTC (TVA 20 %)` : undefined}
            >
              <Input id="np-vente" inputMode="decimal" value={v.prixVenteHT} onChange={set("prixVenteHT")} aria-invalid={!!erreurs.prixVenteHT} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => fermer(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Créer et ajouter au devis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
