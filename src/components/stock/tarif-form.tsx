"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { tarifSchema, type TarifInput } from "@/lib/validators/piece";

interface PieceForfait {
  pieceId: string;
  reference: string;
  nom: string;
  quantite: number;
}

interface PieceHit {
  id: string;
  reference: string;
  nom: string;
  stock: number;
}

export function TarifForm({ tarif }: { tarif?: { id: string; pieces: PieceForfait[] } & Omit<TarifInput, "pieces"> }) {
  const router = useRouter();
  const onDone = useCloseDialog();
  const [pieces, setPieces] = useState<PieceForfait[]>(tarif?.pieces ?? []);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TarifInput>({
    resolver: zodResolver(tarifSchema),
    defaultValues: tarif ? { ...tarif, description: tarif.description ?? "", pieces: [] } : { type: "FORFAIT", libelle: "", description: "", montantHT: 0, actif: true, pieces: [] },
  });
  const forfait = useWatch({ control, name: "type" }) === "FORFAIT";
  const fetchPieces = useCallback(async (q: string) => (await api<{ items: PieceHit[] }>(`/api/stock?q=${encodeURIComponent(q)}`, "GET")).items, []);

  async function onSubmit(values: TarifInput) {
    const payload = { ...values, pieces: forfait ? pieces.map((p) => ({ pieceId: p.pieceId, quantite: p.quantite })) : [] };
    const parsed = tarifSchema.safeParse(payload);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Tarif invalide");
    try {
      if (tarif) await api(`/api/tarifs/${tarif.id}`, "PATCH", parsed.data);
      else await api("/api/tarifs", "POST", parsed.data);
      toast.success(tarif ? "Tarif mis à jour" : "Tarif créé");
      onDone();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Type" htmlFor="type">
        <NativeSelect id="type" {...register("type")}>
          <option value="MO1">Main d&apos;œuvre 1</option>
          <option value="MO2">Main d&apos;œuvre 2</option>
          <option value="MO3">Main d&apos;œuvre 3</option>
          <option value="FORFAIT">Forfait</option>
          <option value="FRAIS_DIVERS">Frais divers</option>
        </NativeSelect>
      </Field>
      <Field label="Libellé" htmlFor="libelle" error={errors.libelle?.message}>
        <Input id="libelle" aria-invalid={!!errors.libelle} {...register("libelle")} />
      </Field>
      <Field label="Description (facultatif)" htmlFor="description" error={errors.description?.message} hint="Détail des prestations comprises, pour l'équipe.">
        <Textarea id="description" rows={2} maxLength={500} aria-invalid={!!errors.description} {...register("description")} />
      </Field>
      <Field label="Montant HT (€)" htmlFor="montantHT" error={errors.montantHT?.message}>
        <Input id="montantHT" type="number" step="0.01" aria-invalid={!!errors.montantHT} {...register("montantHT", { valueAsNumber: true })} />
      </Field>
      {forfait && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Pièces comprises (facultatif)</span>
          <p className="text-xs text-muted-foreground">Quand le forfait est utilisé dans un devis validé, ces pièces sont déduites du stock (× quantité du forfait), comme une ligne pièce.</p>
          {pieces.map((p) => (
            <div key={p.pieceId} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="flex-1">
                <b>{p.reference}</b> · {p.nom}
              </span>
              <Input
                aria-label={`Quantité de ${p.reference}`}
                className="h-8 w-16"
                inputMode="numeric"
                value={p.quantite}
                onChange={(e) => {
                  const q = Math.max(1, Math.min(100, Math.trunc(Number(e.target.value)) || 1));
                  setPieces((ps) => ps.map((x) => (x.pieceId === p.pieceId ? { ...x, quantite: q } : x)));
                }}
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer ${p.reference}`} onClick={() => setPieces((ps) => ps.filter((x) => x.pieceId !== p.pieceId))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <SearchPicker<PieceHit>
            label="Ajouter une pièce au forfait"
            placeholder="Ajouter une pièce (référence, nom…)"
            fetcher={fetchPieces}
            getKey={(p) => p.id}
            renderItem={(p) => (
              <span className="flex justify-between gap-3">
                <span>
                  <b>{p.reference}</b> · {p.nom}
                </span>
                <span className="text-muted-foreground">stock {p.stock}</span>
              </span>
            )}
            onPick={(p) => setPieces((ps) => (ps.some((x) => x.pieceId === p.id) ? ps : [...ps, { pieceId: p.id, reference: p.reference, nom: p.nom, quantite: 1 }]))}
          />
        </div>
      )}
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("actif")} />
        Tarif actif (proposé dans les devis)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{tarif ? "Enregistrer" : "Créer le tarif"}</SubmitButton>
      </div>
    </form>
  );
}
