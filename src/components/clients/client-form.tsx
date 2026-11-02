"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { clientSchema, type ClientInput } from "@/lib/validators/client";

const DEFAUT: ClientInput = {
  type: "PARTICULIER", firstName: "", lastName: "", companyName: "", siret: "", tvaNumber: "",
  email: "", phone: "", address: "", paymentTerms: 30, creditLimit: 0, discountRate: 0, marketingOptIn: false,
};

interface Entreprise {
  siren: string;
  siret: string;
  nom: string;
  adresse: string;
  tvaNumber: string;
}

export interface ClientCree {
  id: string;
  type: "PARTICULIER" | "PRO";
  nom: string;
  discountRate: number;
}

/**
 * Formulaire client. `onSaved` (création à la volée depuis un devis) reçoit le client créé ;
 * sans lui, la fenêtre se ferme et la page est rafraîchie.
 */
export function ClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client?: { id: string } & Partial<ClientInput>;
  onSaved?: (c: ClientCree) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const closeDialog = useCloseDialog();
  const annuler = onCancel ?? closeDialog;
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { ...DEFAUT, ...Object.fromEntries(Object.entries(client ?? {}).map(([k, v]) => [k, v ?? ""])) },
  });
  const type = useWatch({ control, name: "type" });
  const rechercherEntreprise = useCallback(async (q: string) => (q.length < 3 ? [] : api<Entreprise[]>(`/api/integrations/entreprise?q=${encodeURIComponent(q)}`, "GET")), []);

  /** Pré-remplit les informations légales à partir de l'entreprise choisie (nom ou SIRET). */
  function remplir(e: Entreprise) {
    setValue("companyName", e.nom, { shouldValidate: true });
    setValue("siret", e.siret, { shouldValidate: true });
    setValue("tvaNumber", e.tvaNumber);
    setValue("address", e.adresse);
    toast.success("Informations de l'entreprise renseignées");
  }

  async function onSubmit(values: ClientInput) {
    try {
      if (client) {
        await api(`/api/clients/${client.id}`, "PATCH", values);
        toast.success("Client mis à jour");
        closeDialog();
        router.refresh();
        return;
      }
      const c = await api<ClientCree>("/api/clients", "POST", values);
      toast.success("Client créé");
      if (onSaved) onSaved(c);
      else {
        closeDialog();
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Type de client" htmlFor="type">
        <NativeSelect id="type" {...register("type")}>
          <option value="PARTICULIER">Particulier</option>
          <option value="PRO">Professionnel</option>
        </NativeSelect>
      </Field>
      {type === "PRO" && !client && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Rechercher l&apos;entreprise (nom ou SIRET)</span>
          <SearchPicker<Entreprise>
            label="Rechercher une entreprise par nom ou SIRET"
            placeholder="Nom de la société ou n° SIRET…"
            fetcher={rechercherEntreprise}
            getKey={(e) => e.siren + e.siret}
            renderItem={(e) => (
              <span className="flex flex-col">
                <b>{e.nom}</b>
                <span className="text-xs text-muted-foreground">
                  SIRET {e.siret} · {e.adresse}
                </span>
              </span>
            )}
            onPick={remplir}
          />
          <p className="text-xs text-muted-foreground">Adresse, SIRET et n° de TVA sont récupérés automatiquement (base officielle des entreprises).</p>
        </div>
      )}
      {type === "PRO" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Raison sociale" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" aria-invalid={!!errors.companyName} {...register("companyName")} />
          </Field>
          <Field label="SIRET" htmlFor="siret" error={errors.siret?.message}>
            <Input id="siret" inputMode="numeric" placeholder="812 345 678 00019" aria-invalid={!!errors.siret} {...register("siret")} />
          </Field>
          <Field label="N° de TVA" htmlFor="tvaNumber" error={errors.tvaNumber?.message}>
            <Input id="tvaNumber" {...register("tvaNumber")} />
          </Field>
          <Field label="Réduction sur les pièces (%)" htmlFor="discountRate" error={errors.discountRate?.message} hint="Appliquée automatiquement aux pièces des devis, jamais à la main d'œuvre ni aux forfaits.">
            <Input id="discountRate" type="number" step="0.5" aria-invalid={!!errors.discountRate} {...register("discountRate", { valueAsNumber: true })} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={type === "PRO" ? "Prénom du contact" : "Prénom"} htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
        </Field>
        <Field label={type === "PRO" ? "Nom du contact" : "Nom"} htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} {...register("lastName")} />
        </Field>
        <Field label="Adresse e-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" aria-invalid={!!errors.phone} {...register("phone")} />
        </Field>
      </div>
      <Field label="Adresse" htmlFor="address" error={errors.address?.message}>
        <Input id="address" autoComplete="street-address" {...register("address")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Délai de paiement (jours)" htmlFor="paymentTerms" error={errors.paymentTerms?.message}>
          <Input id="paymentTerms" type="number" aria-invalid={!!errors.paymentTerms} {...register("paymentTerms", { valueAsNumber: true })} />
        </Field>
        <Field label="Plafond de crédit (€)" htmlFor="creditLimit" error={errors.creditLimit?.message}>
          <Input id="creditLimit" type="number" step="10" aria-invalid={!!errors.creditLimit} {...register("creditLimit", { valueAsNumber: true })} />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("marketingOptIn")} />
        Le client accepte de recevoir des communications marketing
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={annuler}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{client ? "Enregistrer" : "Créer le client"}</SubmitButton>
      </div>
    </form>
  );
}
