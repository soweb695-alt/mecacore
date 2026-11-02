"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
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
  stock: number;
  seuilAlerte: number;
  taillePneu: string | null;
  referencesCroisees: string[];
}

export function PieceForm({ piece, voirAchat }: { piece?: PieceFormPiece; voirAchat: boolean }) {
  const router = useRouter();
  const onDone = useCloseDialog();
  const {
    register,
    handleSubmit,
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
      stock: piece?.stock ?? 0,
      seuilAlerte: piece?.seuilAlerte ?? 0,
      taillePneu: piece?.taillePneu ?? "",
      refs: piece?.referencesCroisees.join(", ") ?? "",
    },
  });

  async function onSubmit({ refs, ...values }: Values) {
    const body = { ...values, referencesCroisees: refs.split(/[,;\n]/).map((r) => r.trim()).filter(Boolean) };
    try {
      if (piece) await api(`/api/stock/${piece.id}`, "PATCH", body);
      else await api("/api/stock", "POST", body);
      toast.success(piece ? "Pièce mise à jour" : "Pièce créée");
      onDone();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  const num = (name: "prixAchatHT" | "prixVenteHT" | "stock" | "seuilAlerte") => register(name, { valueAsNumber: true });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Référence" htmlFor="reference" error={errors.reference?.message}>
          <Input id="reference" className="uppercase" aria-invalid={!!errors.reference} {...register("reference")} />
        </Field>
        <Field label="Catégorie" htmlFor="categorie" error={errors.categorie?.message}>
          <Input id="categorie" placeholder="Freinage, Filtration…" {...register("categorie")} />
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
      <div className={voirAchat ? "grid grid-cols-4 gap-3" : "grid grid-cols-3 gap-3"}>
        {voirAchat && (
          <Field label="Prix achat HT (€)" htmlFor="prixAchatHT" error={errors.prixAchatHT?.message}>
            <Input id="prixAchatHT" type="number" step="0.01" aria-invalid={!!errors.prixAchatHT} {...num("prixAchatHT")} />
          </Field>
        )}
        <Field label="Prix vente HT (€)" htmlFor="prixVenteHT" error={errors.prixVenteHT?.message}>
          <Input id="prixVenteHT" type="number" step="0.01" aria-invalid={!!errors.prixVenteHT} {...num("prixVenteHT")} />
        </Field>
        <Field label="Stock" htmlFor="stock" error={errors.stock?.message}>
          <Input id="stock" type="number" aria-invalid={!!errors.stock} {...num("stock")} />
        </Field>
        <Field label="Seuil d'alerte" htmlFor="seuilAlerte" error={errors.seuilAlerte?.message}>
          <Input id="seuilAlerte" type="number" aria-invalid={!!errors.seuilAlerte} {...num("seuilAlerte")} />
        </Field>
      </div>
      <Field label="Taille de pneu (optionnel)" htmlFor="taillePneu" error={errors.taillePneu?.message}>
        <Input id="taillePneu" placeholder="205/55 R16" aria-invalid={!!errors.taillePneu} {...register("taillePneu")} />
      </Field>
      <Field label="Références croisées" htmlFor="refs" error={errors.refs?.message} hint="Séparées par des virgules : TRW GDB1550, ATE 13.0460">
        <Input id="refs" {...register("refs")} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{piece ? "Enregistrer" : "Créer la pièce"}</SubmitButton>
      </div>
    </form>
  );
}
