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
import { garageSchema } from "@/lib/validators/parametres";

type Values = z.input<typeof garageSchema>;

export function GarageForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(garageSchema), defaultValues: initial });

  async function onSubmit(values: Values) {
    try {
      await api("/api/parametres/garage", "PATCH", values);
      toast.success("Informations du garage enregistrées");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <Field label="Nom du garage" htmlFor="nomGarage" error={errors.nomGarage?.message} className="sm:col-span-2">
        <Input id="nomGarage" aria-invalid={!!errors.nomGarage} {...register("nomGarage")} />
      </Field>
      <Field label="Adresse" htmlFor="adresse" error={errors.adresse?.message} className="sm:col-span-2">
        <Input id="adresse" autoComplete="street-address" placeholder="12 rue des Lilas, 69000 Lyon" aria-invalid={!!errors.adresse} {...register("adresse")} />
      </Field>
      <Field label="Téléphone" htmlFor="telephone" error={errors.telephone?.message}>
        <Input id="telephone" type="tel" aria-invalid={!!errors.telephone} {...register("telephone")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="SIRET" htmlFor="siret" error={errors.siret?.message}>
        <Input id="siret" inputMode="numeric" aria-invalid={!!errors.siret} {...register("siret")} />
      </Field>
      <Field label="N° de TVA intracommunautaire" htmlFor="tvaNumber" error={errors.tvaNumber?.message}>
        <Input id="tvaNumber" className="uppercase" placeholder="FR…" aria-invalid={!!errors.tvaNumber} {...register("tvaNumber")} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pending={isSubmitting}>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
