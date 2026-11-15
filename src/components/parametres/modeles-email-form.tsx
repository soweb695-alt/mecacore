"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { MODELES_DEFAUT, VARIABLES, type CleModele } from "@/lib/messages/modeles-email";
import type { ModelesEmailInput } from "@/lib/validators/parametres";

const TITRES: Record<CleModele, string> = { vehiculePret: "Véhicule prêt", rappelRdv: "Rappel de rendez-vous" };

/** Modèles d'e-mails : un champ vide utilise le texte par défaut (affiché en exemple). */
export function ModelesEmailForm({ initial }: { initial: ModelesEmailInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const set = (cle: CleModele, champ: "sujet" | "corps", val: string) => setV((x) => ({ ...x, [cle]: { ...x[cle], [champ]: val } }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api("/api/parametres/modeles-email", "PUT", v);
      toast.success("Modèles d'e-mails enregistrés");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      {(Object.keys(TITRES) as CleModele[]).map((cle) => (
        <fieldset key={cle} className="space-y-3">
          <legend className="text-sm font-semibold">{TITRES[cle]}</legend>
          <Field label="Objet" htmlFor={`${cle}-sujet`}>
            <Input id={`${cle}-sujet`} maxLength={150} placeholder={MODELES_DEFAUT[cle].sujet} value={v[cle].sujet} onChange={(e) => set(cle, "sujet", e.target.value)} />
          </Field>
          <Field label="Message" htmlFor={`${cle}-corps`} hint={`Variables : ${VARIABLES[cle].map((x) => `{${x}}`).join(", ")}. Laissé vide : texte par défaut ci-dessus.`}>
            <Textarea id={`${cle}-corps`} rows={8} maxLength={4000} placeholder={MODELES_DEFAUT[cle].corps} value={v[cle].corps} onChange={(e) => set(cle, "corps", e.target.value)} />
          </Field>
        </fieldset>
      ))}
      <SubmitButton pending={pending}>Enregistrer les modèles</SubmitButton>
    </form>
  );
}
