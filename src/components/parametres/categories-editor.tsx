"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

export interface Categorie {
  id: string;
  libelle: string;
  /** Nombre de pièces actives dans cette catégorie. */
  pieces: number;
}

/**
 * Catégories de pièces (même composant que la fiche de contrôle) : ajout, renommage (les pièces suivent), ordre, suppression
 * (les pièces gardent leur catégorie).
 */
export function CategoriesEditor({ categories }: { categories: Categorie[] }) {
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
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {categories.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Aucune catégorie : la fiche pièce n&apos;en proposera pas.</li>}
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <Input
              aria-label={`Nom de la catégorie ${i + 1}`}
              defaultValue={c.libelle}
              maxLength={60}
              disabled={pending}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.libelle) void agir(() => api(`/api/categories-pieces/${c.id}`, "PATCH", { libelle: v }), "Catégorie renommée");
              }}
            />
            <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">{c.pieces} pièce{c.pieces > 1 ? "s" : ""}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Monter" disabled={pending || i === 0} onClick={() => agir(() => api(`/api/categories-pieces/${c.id}`, "PATCH", { deplacer: "haut" }))}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Descendre" disabled={pending || i === categories.length - 1} onClick={() => agir(() => api(`/api/categories-pieces/${c.id}`, "PATCH", { deplacer: "bas" }))}>
              <ArrowDown aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer ${c.libelle}`} disabled={pending} onClick={() => agir(() => api(`/api/categories-pieces/${c.id}`, "DELETE"), "Catégorie supprimée")}>
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
            await api("/api/categories-pieces", "POST", { libelle: v });
            setNouveau("");
          }, "Catégorie ajoutée");
        }}
      >
        <Input aria-label="Nouvelle catégorie" placeholder="Nouvelle catégorie…" maxLength={60} value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        <Button type="submit" disabled={pending || nouveau.trim().length < 2}>
          <Plus aria-hidden />
          Ajouter
        </Button>
      </form>
    </div>
  );
}
