"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/forms/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client-api";
import { JOURS, type Horaires } from "@/lib/validators/parametres";

const LIBELLE: Record<(typeof JOURS)[number], string> = { lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi", vendredi: "Vendredi", samedi: "Samedi", dimanche: "Dimanche" };

export function HorairesForm({ initial }: { initial: Horaires }) {
  const router = useRouter();
  const [h, setH] = useState(initial);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api("/api/parametres/horaires", "PUT", h);
      toast.success("Horaires enregistrés");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-2">
      {JOURS.map((j) => (
        <div key={j} className="grid grid-cols-[7rem_1fr] items-center gap-3">
          <Label htmlFor={`h-${j}`}>{LIBELLE[j]}</Label>
          <Input id={`h-${j}`} maxLength={60} placeholder="08:00-12:00 / 14:00-18:00 ou fermé" value={h[j]} onChange={(e) => setH({ ...h, [j]: e.target.value })} />
        </div>
      ))}
      <div className="pt-2">
        <SubmitButton pending={pending}>Enregistrer les horaires</SubmitButton>
      </div>
    </form>
  );
}
