"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useParametres } from "@/components/parametres-context";
import { api } from "@/lib/client-api";
import { calculerMarge, prixHTDepuisTTC, prixTTCDepuisHT, TVA_PIECE, venteHTDepuisMarge, venteHTDepuisTauxMarge } from "@/lib/money";
import { pieceSchema } from "@/lib/validators/piece";

const formSchema = pieceSchema.omit({ referencesCroisees: true }).extend({ refs: z.string().max(900) });
type Values = z.infer<typeof formSchema>;

export interface PieceFormPiece {
  id: string;
  reference: string;
  nom: string;
  marque: string | null;
  fournisseur: string | null;
  categorie: string | null;
  prixAchatHT?: number;
  prixVenteHT: number;
  prixVenteTTC?: number;
  stock: number;
  seuilAlerte: number;
  alerteActive?: boolean;
  taillePneu: string | null;
  referencesCroisees: string[];
}

/** Pièce renvoyée par l'API du stock après création ou mise à jour. */
export interface PieceEnregistree {
  id: string;
  reference: string;
  nom: string;
  prixVenteHT: number;
  prixVenteTTC: number;
  prixAchatHT?: number;
  stock: number;
  seuilAlerte: number;
  alerteActive: boolean;
}

type ChampMarge = "margeEur" | "margePct";
const lire = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")));
const enTexte = (n: number) => String(n).replace(".", ",");

/**
 * Formulaire de pièce, commun au Stock et au devis (« Nouvelle pièce »).
 * Prix de vente HT, TTC et marge (€ et %) modifiables et synchronisés ; le TTC enregistré fait foi.
 * `onSaved` : appelé avec la pièce enregistrée (devis) au lieu de rafraîchir la page.
 */
export function PieceForm({
  piece,
  voirAchat,
  voirMarge = false,
  onSaved,
  onCancel,
  libelleCreer = "Créer la pièce",
}: {
  piece?: PieceFormPiece;
  voirAchat: boolean;
  voirMarge?: boolean;
  onSaved?: (p: PieceEnregistree) => void;
  onCancel?: () => void;
  libelleCreer?: string;
}) {
  const router = useRouter();
  const fermerDialogue = useCloseDialog();
  const annuler = onCancel ?? fermerDialogue;
  // Catégories et seuil par défaut : Paramètres › Stocks & alertes.
  const { categories, seuilAlerteDefaut } = useParametres();
  const choixCategories = piece?.categorie && !categories.includes(piece.categorie) ? [...categories, piece.categorie] : categories;
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reference: piece?.reference ?? "",
      nom: piece?.nom ?? "",
      marque: piece?.marque ?? "",
      fournisseur: piece?.fournisseur ?? "",
      categorie: piece?.categorie ?? "",
      prixAchatHT: voirAchat ? (piece?.prixAchatHT ?? 0) : undefined,
      prixVenteHT: piece?.prixVenteHT ?? 0,
      prixVenteTTC: piece ? (piece.prixVenteTTC ?? prixTTCDepuisHT(piece.prixVenteHT, TVA_PIECE)) : 0,
      stock: piece?.stock ?? 0,
      seuilAlerte: piece?.seuilAlerte ?? seuilAlerteDefaut,
      alerteActive: piece?.alerteActive ?? true,
      taillePneu: piece?.taillePneu ?? "",
      refs: piece?.referencesCroisees.join(", ") ?? "",
    },
  });

  async function onSubmit({ refs, ...values }: Values) {
    const body = { ...values, referencesCroisees: refs.split(/[,;\n]/).map((r) => r.trim()).filter(Boolean) };
    try {
      const p = piece ? await api<PieceEnregistree>(`/api/stock/${piece.id}`, "PATCH", body) : await api<PieceEnregistree>("/api/stock", "POST", body);
      if (onSaved) onSaved(p);
      else {
        toast.success(piece ? "Pièce mise à jour" : "Pièce créée");
        fermerDialogue();
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  // Prix synchronisés (TVA 20 %) : le champ saisi est la source, les autres sont recalculés au centime.
  const [venteSaisie, achatSaisie] = useWatch({ control, name: ["prixVenteHT", "prixAchatHT"] });
  const avecMarge = voirMarge && voirAchat;
  const vente = lire(venteSaisie);
  const achat = lire(achatSaisie) || 0;
  const marge = avecMarge && Number.isFinite(vente) ? calculerMarge(vente, achat) : null;
  // Champ de marge en cours de saisie : son texte est affiché tel quel jusqu'à la sortie du champ.
  const [saisieMarge, setSaisieMarge] = useState<{ champ: ChampMarge; texte: string } | null>(null);
  const [erreurMarge, setErreurMarge] = useState<string | null>(null);
  const opts = { shouldValidate: true, shouldDirty: true } as const;

  function venteDepuis(ht: number) {
    setValue("prixVenteHT", ht, opts);
    setValue("prixVenteTTC", prixTTCDepuisHT(ht, TVA_PIECE), opts);
  }
  const surHT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ht = lire(e.target.value);
    if (Number.isFinite(ht)) setValue("prixVenteTTC", prixTTCDepuisHT(ht, TVA_PIECE), opts);
  };
  const surTTC = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ttc = lire(e.target.value);
    if (Number.isFinite(ttc)) setValue("prixVenteHT", prixHTDepuisTTC(ttc, TVA_PIECE), opts);
  };
  function surMarge(champ: ChampMarge, texte: string) {
    setSaisieMarge({ champ, texte });
    const n = lire(texte);
    if (texte.trim() === "" || !Number.isFinite(n)) return setErreurMarge(null);
    const a = lire(getValues("prixAchatHT")) || 0;
    if (champ === "margeEur") {
      setErreurMarge(null);
      return venteDepuis(Math.max(0, venteHTDepuisMarge(a, n)));
    }
    const ht = venteHTDepuisTauxMarge(a, n);
    if (ht === null) return setErreurMarge(a > 0 ? "Le taux doit être inférieur à 100 %." : "Saisissez d'abord le prix d'achat.");
    setErreurMarge(null);
    venteDepuis(ht);
  }
  const valeurMarge = (champ: ChampMarge) =>
    saisieMarge?.champ === champ ? saisieMarge.texte : marge ? enTexte(champ === "margeEur" ? marge.montant : marge.pct) : "";
  const quitterMarge = () => setSaisieMarge(null);

  const num = (name: "prixAchatHT" | "stock" | "seuilAlerte") => register(name, { valueAsNumber: true });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Référence" htmlFor="reference" error={errors.reference?.message}>
          <Input id="reference" className="uppercase" aria-invalid={!!errors.reference} {...register("reference")} />
        </Field>
        <Field label="Catégorie" htmlFor="categorie" error={errors.categorie?.message}>
          <NativeSelect id="categorie" {...register("categorie")}>
            <option value="">Sans catégorie</option>
            {choixCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Désignation" htmlFor="nom" error={errors.nom?.message}>
        <Input id="nom" aria-invalid={!!errors.nom} {...register("nom")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marque" htmlFor="marque" error={errors.marque?.message}>
          <Input id="marque" {...register("marque")} />
        </Field>
        <Field label="Fournisseur" htmlFor="fournisseur" error={errors.fournisseur?.message}>
          <Input id="fournisseur" {...register("fournisseur")} />
        </Field>
      </div>
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">Prix (TVA 20 %)</legend>
        {voirAchat && (
          <Field label="Prix achat HT (€)" htmlFor="prixAchatHT" error={errors.prixAchatHT?.message}>
            <Input id="prixAchatHT" type="number" step="0.01" min={0} aria-invalid={!!errors.prixAchatHT} {...num("prixAchatHT")} />
          </Field>
        )}
        <Field label="Prix vente HT (€)" htmlFor="prixVenteHT" error={errors.prixVenteHT?.message}>
          <Input id="prixVenteHT" type="number" step="0.01" min={0} aria-invalid={!!errors.prixVenteHT} {...register("prixVenteHT", { valueAsNumber: true, onChange: surHT })} />
        </Field>
        <Field label="Prix vente TTC (€)" htmlFor="prixVenteTTC" error={errors.prixVenteTTC?.message}>
          <Input id="prixVenteTTC" type="number" step="0.01" min={0} aria-invalid={!!errors.prixVenteTTC} {...register("prixVenteTTC", { valueAsNumber: true, onChange: surTTC })} />
        </Field>
        {avecMarge && (
          <>
            <Field label="Marge HT (€)" htmlFor="margeEur">
              <Input id="margeEur" inputMode="decimal" className={marge && marge.montant < 0 ? "text-destructive" : undefined} value={valeurMarge("margeEur")} onChange={(e) => surMarge("margeEur", e.target.value)} onBlur={quitterMarge} />
            </Field>
            <Field label="Marge (% du prix de vente)" htmlFor="margePct" error={erreurMarge ?? undefined}>
              <Input id="margePct" inputMode="decimal" aria-invalid={!!erreurMarge} value={valeurMarge("margePct")} onChange={(e) => surMarge("margePct", e.target.value)} onBlur={() => { quitterMarge(); setErreurMarge(null); }} />
            </Field>
          </>
        )}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stock" htmlFor="stock" error={errors.stock?.message}>
          <Input id="stock" type="number" aria-invalid={!!errors.stock} {...num("stock")} />
        </Field>
        <Field label="Seuil d'alerte" htmlFor="seuilAlerte" error={errors.seuilAlerte?.message}>
          <Input id="seuilAlerte" type="number" aria-invalid={!!errors.seuilAlerte} {...num("seuilAlerte")} />
        </Field>
        <label className="col-span-full flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...register("alerteActive")} />
          <span>
            Alerter quand le stock atteint le seuil
            <span className="block text-xs text-muted-foreground">Décoché : aucune alerte (liste, tableau de bord, devis) ni bon de commande automatique pour cette pièce.</span>
          </span>
        </label>
      </div>
      <Field label="Taille de pneu (optionnel)" htmlFor="taillePneu" error={errors.taillePneu?.message}>
        <Input id="taillePneu" placeholder="205/55 R16" aria-invalid={!!errors.taillePneu} {...register("taillePneu")} />
      </Field>
      <Field label="Références croisées" htmlFor="refs" error={errors.refs?.message} hint="Séparées par des virgules : TRW GDB1550, ATE 13.0460">
        <Input id="refs" {...register("refs")} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={annuler}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{piece ? "Enregistrer" : libelleCreer}</SubmitButton>
      </div>
    </form>
  );
}
