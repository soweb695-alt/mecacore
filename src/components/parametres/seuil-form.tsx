"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/form-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { stockParametresSchema } from "@/lib/validators/parametres";

/** Seuil d'alerte proposé pour une nouvelle pièce (fiche pièce, « Nouvelle pièce » du devis, import). */
export function SeuilForm({ initial }: { initial: number }) {
  const router = useRouter();
  const [valeur, setValeur] = useState(String(initial));
  const [erreur, setErreur] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = stockParametresSchema.safeParse({ seuilAlerteDefaut: valeur.trim() === "" ? NaN : Number(valeur) });
    if (!parsed.success) return setErreur(parsed.error.issues[0]?.code === "invalid_type" ? "Nombre entier requis" : parsed.error.issues[0]?.message);
    setErreur(undefined);
    setPending(true);
    try {
      await api("/api/parametres/stock", "PUT", parsed.data);
      toast.success("Seuil d'alerte par défaut enregistré");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-end gap-2">
      <Field label="Seuil d'alerte" htmlFor="seuil-defaut" error={erreur} className="w-40">
        <Input id="seuil-defaut" type="number" min={0} step={1} value={valeur} aria-invalid={!!erreur} onChange={(e) => setValeur(e.target.value)} />
      </Field>
      <SubmitButton pending={pending}>Enregistrer</SubmitButton>
    </form>
  );
}
