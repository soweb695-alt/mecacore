"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { vehiculeSchema, type VehiculeInput } from "@/lib/validators/vehicule";

interface ClientHit {
  id: string;
  type: "PARTICULIER" | "PRO";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}

const nomClientHit = (c: ClientHit) => (c.type === "PRO" && c.companyName ? c.companyName : [c.firstName, c.lastName].filter(Boolean).join(" "));
const nombreOuNull = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export interface VehiculeSaved {
  id: string;
  clientId: string | null;
  immatriculation: string;
  marque: string;
  modele: string;
  annee: number | null;
  motorisation: string | null;
  vin: string | null;
  kilometrage: number | null;
  prochainCT: string | null;
}

/**
 * Formulaire de véhicule. Le véhicule existe d'abord : le client lui est associé (facultatif).
 * - `clientId` fourni (fiche client) : propriétaire imposé ;
 * - sinon un sélecteur de client est proposé.
 * `onSaved` permet de réutiliser le formulaire dans le devis (sans recharger la page).
 */
export function VehiculeForm({
  clientId,
  clientNom,
  vehicule,
  onSaved,
  onCancel,
}: {
  clientId?: string | null;
  clientNom?: string;
  vehicule?: { id: string } & Partial<Omit<VehiculeInput, "prochainCT">> & { prochainCT?: string | null };
  onSaved?: (v: VehiculeSaved) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const closeDialog = useCloseDialog();
  const annuler = onCancel ?? closeDialog;
  const idProprio = vehicule?.clientId ?? clientId ?? null;
  const [proprio, setProprio] = useState<{ id: string; nom: string } | null>(idProprio ? { id: idProprio, nom: clientNom ?? "Propriétaire actuel" } : null);
  const imposé = !!clientId && !vehicule;
  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VehiculeInput>({
    resolver: zodResolver(vehiculeSchema),
    defaultValues: {
      clientId: idProprio,
      vin: vehicule?.vin ?? "",
      immatriculation: vehicule?.immatriculation ?? "",
      marque: vehicule?.marque ?? "",
      modele: vehicule?.modele ?? "",
      annee: vehicule?.annee ?? null,
      motorisation: vehicule?.motorisation ?? "",
      kilometrage: vehicule?.kilometrage ?? null,
      prochainCT: vehicule?.prochainCT ?? "",
    },
  });

  async function onSubmit(values: VehiculeInput) {
    const body = { ...values, clientId: proprio?.id ?? null };
    try {
      let id = vehicule?.id;
      if (id) await api(`/api/vehicules/${id}`, "PATCH", body);
      else id = (await api<{ id: string }>("/api/vehicules", "POST", body)).id;
      toast.success(vehicule ? "Véhicule mis à jour" : "Véhicule ajouté");
      if (onSaved) {
        onSaved({
          id: id!,
          clientId: body.clientId,
          immatriculation: values.immatriculation.toUpperCase().replace(/\s/g, "-"),
          marque: values.marque,
          modele: values.modele,
          annee: values.annee,
          motorisation: values.motorisation || null,
          vin: values.vin || null,
          kilometrage: values.kilometrage ?? null,
          prochainCT: values.prochainCT || null,
        });
      } else {
        closeDialog();
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation(); // formulaire imbriqué dans le devis : ne pas soumettre le parent
        return handleSubmit(onSubmit)(e);
      }}
      noValidate
      className="space-y-4"
    >
      {!imposé && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Client associé (facultatif)</span>
          {proprio && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-medium">{proprio.nom}</span>
              <button type="button" className="text-xs text-link hover:underline" onClick={() => setProprio(null)}>
                Retirer
              </button>
            </div>
          )}
          <SearchPicker<ClientHit>
            label="Rechercher un client à associer"
            placeholder={proprio ? "Changer de client…" : "Rechercher un client…"}
            fetcher={fetchClients}
            getKey={(c) => c.id}
            renderItem={nomClientHit}
            onPick={(c) => setProprio({ id: c.id, nom: nomClientHit(c) })}
          />
        </div>
      )}
      {imposé && clientNom && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Propriétaire : <b>{clientNom}</b>
        </p>
      )}
      <Field label="Immatriculation" htmlFor="immatriculation" error={errors.immatriculation?.message}>
        <Input id="immatriculation" className="uppercase" placeholder="AB-123-CD" aria-invalid={!!errors.immatriculation} {...register("immatriculation")} />
      </Field>
      <Field label="VIN (optionnel)" htmlFor="vin" error={errors.vin?.message} hint="17 caractères (case E de la carte grise).">
        <Input id="vin" maxLength={17} className="uppercase" aria-invalid={!!errors.vin} {...register("vin")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Année" htmlFor="annee" error={errors.annee?.message}>
          <Input id="annee" type="number" aria-invalid={!!errors.annee} {...register("annee", { setValueAs: nombreOuNull })} />
        </Field>
        <Field label="Marque" htmlFor="marque" error={errors.marque?.message}>
          <Input id="marque" aria-invalid={!!errors.marque} {...register("marque")} />
        </Field>
        <Field label="Modèle" htmlFor="modele" error={errors.modele?.message}>
          <Input id="modele" aria-invalid={!!errors.modele} {...register("modele")} />
        </Field>
        <Field label="Kilométrage" htmlFor="kilometrage" error={errors.kilometrage?.message}>
          <Input id="kilometrage" type="number" inputMode="numeric" aria-invalid={!!errors.kilometrage} {...register("kilometrage", { setValueAs: nombreOuNull })} />
        </Field>
        <Field label="Prochain contrôle technique" htmlFor="prochainCT" error={errors.prochainCT?.message}>
          <Input id="prochainCT" type="date" {...register("prochainCT")} />
        </Field>
      </div>
      <Field label="Motorisation" htmlFor="motorisation" error={errors.motorisation?.message}>
        <Input id="motorisation" placeholder="1.5 BlueHDi 130" {...register("motorisation")} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={annuler}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{vehicule ? "Enregistrer" : "Ajouter le véhicule"}</SubmitButton>
      </div>
    </form>
  );
}
