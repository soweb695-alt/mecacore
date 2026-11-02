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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { AUDIENCES, campagneSchema, type CampagneInput } from "@/lib/validators/campagne";

export function CampagneForm({ campagne, compteurs }: { campagne?: { id: string } & CampagneInput; compteurs: Record<"TOUS" | "PARTICULIER" | "PRO", number> }) {
  const router = useRouter();
  const close = useCloseDialog();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CampagneInput>({
    resolver: zodResolver(campagneSchema),
    defaultValues: campagne ?? { nom: "", audience: "TOUS", sujet: "", contenu: "" },
  });
  const audience = useWatch({ control, name: "audience" });

  async function onSubmit(values: CampagneInput) {
    try {
      if (campagne) await api(`/api/campagnes/${campagne.id}`, "PATCH", values);
      else await api("/api/campagnes", "POST", values);
      toast.success(campagne ? "Campagne mise à jour" : "Campagne créée");
      close();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Nom de la campagne (usage interne)" htmlFor="nom" error={errors.nom?.message}>
        <Input id="nom" placeholder="Promotion pneus hiver" aria-invalid={!!errors.nom} {...register("nom")} />
      </Field>
      <Field label="Destinataires" htmlFor="audience" hint={`${compteurs[audience]} client${compteurs[audience] > 1 ? "s" : ""} avec e-mail et accord marketing (opt-in).`}>
        <NativeSelect id="audience" {...register("audience")}>
          {Object.entries(AUDIENCES).map(([k, v]) => (
            <option key={k} value={k}>
              {v} ({compteurs[k as keyof typeof compteurs]})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Objet de l'e-mail" htmlFor="sujet" error={errors.sujet?.message}>
        <Input id="sujet" maxLength={150} placeholder="-15 % sur les pneus d'hiver jusqu'au 30 novembre" aria-invalid={!!errors.sujet} {...register("sujet")} />
      </Field>
      <Field
        label="Message"
        htmlFor="contenu"
        error={errors.contenu?.message}
        hint="Texte simple : une ligne vide sépare les paragraphes. {prenom}, {nom} et {garage} sont remplacés. Un lien de désinscription est ajouté automatiquement."
      >
        <Textarea id="contenu" rows={8} maxLength={5000} aria-invalid={!!errors.contenu} {...register("contenu")} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{campagne ? "Enregistrer" : "Créer la campagne"}</SubmitButton>
      </div>
    </form>
  );
}
