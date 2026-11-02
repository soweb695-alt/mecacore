"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { paiementSchema } from "@/lib/validators/facture";
import type { z } from "zod";

type Values = z.infer<typeof paiementSchema>;

export function PaiementForm({ factureId, reste }: { factureId: string; reste: number }) {
  const router = useRouter();
  const close = useCloseDialog();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(paiementSchema), defaultValues: { montant: reste, mode: "CB", nombreFois: null, reference: "" } });
  const mode = useWatch({ control, name: "mode" });
  const fois = useWatch({ control, name: "nombreFois" });

  async function onSubmit(values: Values) {
    if (values.montant > reste + 0.001) {
      toast.error("Le montant dépasse le reste à payer.");
      return;
    }
    try {
      await api(`/api/factures/${factureId}/paiements`, "POST", values);
      toast.success("Paiement enregistré");
      close();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Montant (€)" htmlFor="montant" error={errors.montant?.message} hint={`Reste à payer : ${reste.toFixed(2)} €`}>
        <Input id="montant" type="number" step="0.01" aria-invalid={!!errors.montant} {...register("montant", { valueAsNumber: true })} />
      </Field>
      <Field label="Mode de paiement" htmlFor="mode">
        <NativeSelect
          id="mode"
          {...register("mode", {
            onChange: (e) => {
              if (e.target.value !== "PLUSIEURS_FOIS") {
                setValue("nombreFois", null);
                setValue("montant", reste);
              }
            },
          })}
        >
          <option value="CB">Carte bancaire</option>
          <option value="ESPECES">Espèces</option>
          <option value="CHEQUE">Chèque</option>
          <option value="VIREMENT">Virement</option>
          <option value="PLUSIEURS_FOIS">Paiement en plusieurs fois</option>
        </NativeSelect>
      </Field>
      {mode === "PLUSIEURS_FOIS" && (
        <Field
          label="En combien de fois ?"
          htmlFor="nombreFois"
          error={errors.nombreFois?.message}
          hint={fois ? `Échéance de ${(Math.round((reste / fois) * 100) / 100).toFixed(2)} € × ${fois} (montant ci-dessus = première échéance)` : undefined}
        >
          <NativeSelect
            id="nombreFois"
            aria-invalid={!!errors.nombreFois}
            {...register("nombreFois", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
              onChange: (e) => {
                const n = Number(e.target.value);
                if (n >= 2) setValue("montant", Math.round((reste / n) * 100) / 100);
              },
            })}
          >
            <option value="">Choisir…</option>
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} fois
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      <Field label="Référence (optionnel)" htmlFor="reference" error={errors.reference?.message}>
        <Input id="reference" maxLength={80} placeholder="N° de chèque, référence du virement…" {...register("reference")} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>Enregistrer le paiement</SubmitButton>
      </div>
    </form>
  );
}
