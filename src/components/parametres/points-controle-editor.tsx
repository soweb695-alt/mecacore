"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

export interface PointModele {
  id: string;
  libelle: string;
  isActive: boolean;
}

/** Modèle de la fiche de contrôle : ajout, renommage, ordre, désactivation. N'affecte pas les fiches déjà créées. */
export function PointsControleEditor({ points }: { points: PointModele[] }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState("");
  const [pending, setPending] = useState(false);

  async function agir(fn: () => Promise<unknown>, ok?: string) {
    setPending(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <ul className="divide-y rounded-lg border">
        {points.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Aucun point : les fiches de contrôle seront vides.</li>}
        {points.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 px-3 py-2">
            <Input
              aria-label={`Libellé du point ${i + 1}`}
              defaultValue={p.libelle}
              maxLength={120}
              disabled={pending}
              className={p.isActive ? undefined : "text-muted-foreground line-through"}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.libelle) void agir(() => api(`/api/points-controle/${p.id}`, "PATCH", { libelle: v }), "Point renommé");
              }}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Monter" disabled={pending || i === 0} onClick={() => agir(() => api(`/api/points-controle/${p.id}`, "PATCH", { deplacer: "haut" }))}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Descendre" disabled={pending || i === points.length - 1} onClick={() => agir(() => api(`/api/points-controle/${p.id}`, "PATCH", { deplacer: "bas" }))}>
              <ArrowDown aria-hidden />
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => agir(() => api(`/api/points-controle/${p.id}`, "PATCH", { isActive: !p.isActive }))}>
              {p.isActive ? "Désactiver" : "Activer"}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Supprimer" disabled={pending} onClick={() => agir(() => api(`/api/points-controle/${p.id}`, "DELETE"), "Point supprimé")}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = nouveau.trim();
          if (v.length < 2) return;
          void agir(async () => {
            await api("/api/points-controle", "POST", { libelle: v });
            setNouveau("");
          }, "Point ajouté");
        }}
      >
        <Input aria-label="Nouveau point de contrôle" placeholder="Nouveau point de contrôle…" maxLength={120} value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        <Button type="submit" disabled={pending || nouveau.trim().length < 2}>
          <Plus aria-hidden />
          Ajouter
        </Button>
      </form>
    </div>
  );
}
