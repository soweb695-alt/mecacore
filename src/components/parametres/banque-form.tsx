"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/form-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { banqueSchema } from "@/lib/validators/parametres";

type Values = z.input<typeof banqueSchema>;

export function BanqueForm({ iban, bic }: { iban: string; bic: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(banqueSchema), defaultValues: { iban, bic } });

  async function onSubmit(values: Values) {
    try {
      await api("/api/parametres/banque", "PATCH", values);
      toast.success("Coordonnées bancaires enregistrées");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-xl gap-4">
      <Field label="IBAN" htmlFor="iban" error={errors.iban?.message} hint="Affiché sur le PDF des factures dont le mode de règlement est « Virement ». Laissez vide pour ne rien afficher.">
        <Input id="iban" autoComplete="off" className="uppercase" placeholder="FR76 …" aria-invalid={!!errors.iban} {...register("iban")} />
      </Field>
      <Field label="BIC" htmlFor="bic" error={errors.bic?.message}>
        <Input id="bic" autoComplete="off" className="max-w-48 uppercase" aria-invalid={!!errors.bic} {...register("bic")} />
      </Field>
      <div>
        <SubmitButton pending={isSubmitting}>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
