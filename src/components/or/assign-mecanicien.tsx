"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";

export function AssignMecanicien({ ordreId, valeur, mecaniciens }: { ordreId: string; valeur: string | null; mecaniciens: { id: string; nom: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(valeur ?? "");
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="assign" className="text-sm text-muted-foreground">
        Technicien
      </label>
      <NativeSelect
        id="assign"
        className="w-52"
        value={v}
        onChange={async (e) => {
          const next = e.target.value;
          setV(next);
          try {
            await api(`/api/ordres-reparation/${ordreId}`, "PATCH", { userId: next || null });
            toast.success("Assignation enregistrée");
            router.refresh();
          } catch (err) {
            setV(valeur ?? "");
            toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
          }
        }}
      >
        <option value="">Non assigné</option>
        {mecaniciens.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
