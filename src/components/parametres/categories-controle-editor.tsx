"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PointsControleEditor, type PointModele } from "@/components/parametres/points-controle-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { LIBELLE_TYPE, TYPES_STATUTS, type TypeStatuts } from "@/lib/fiche-controle";

export interface CategorieModele {
  id: string;
  libelle: string;
  typeStatuts: TypeStatuts;
  isActive: boolean;
  points: PointModele[];
}

/**
 * Modèle de la fiche de contrôle : catégories (nom, colonnes de statut, ordre, activation) et leurs points.
 * Chaque nouvel ordre de réparation en reçoit une copie ; les fiches déjà créées ne changent pas.
 */
export function CategoriesControleEditor({ categories }: { categories: CategorieModele[] }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState("");
  const [type, setType] = useState<TypeStatuts>("OK_A_REPARER");
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
  const patch = (id: string, body: object, ok?: string) => agir(() => api(`/api/categories-controle/${id}`, "PATCH", body), ok);

  return (
    <div className="space-y-6">
      {categories.length === 0 && <p className="text-sm text-muted-foreground">Aucune catégorie : les fiches de contrôle seront vides.</p>}
      {categories.map((c, i) => (
        <div key={c.id} className={c.isActive ? "space-y-2" : "space-y-2 opacity-60"}>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={`Nom de la catégorie ${i + 1}`}
              defaultValue={c.libelle}
              maxLength={80}
              disabled={pending}
              className="w-full font-semibold sm:w-44"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.libelle) void patch(c.id, { libelle: v }, "Catégorie renommée");
              }}
            />
            <NativeSelect aria-label={`Statuts de ${c.libelle}`} className="w-36" value={c.typeStatuts} disabled={pending} onChange={(e) => patch(c.id, { typeStatuts: e.target.value }, "Statuts modifiés")}>
              {TYPES_STATUTS.map((t) => (
                <option key={t} value={t}>
                  {LIBELLE_TYPE[t]}
                </option>
              ))}
            </NativeSelect>
            <Button type="button" variant="ghost" size="icon" aria-label={`Monter ${c.libelle}`} disabled={pending || i === 0} onClick={() => patch(c.id, { deplacer: "haut" })}>
              <ArrowUp aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Descendre ${c.libelle}`} disabled={pending || i === categories.length - 1} onClick={() => patch(c.id, { deplacer: "bas" })}>
              <ArrowDown aria-hidden />
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => patch(c.id, { isActive: !c.isActive })}>
              {c.isActive ? "Désactiver" : "Activer"}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer ${c.libelle}`} disabled={pending} onClick={() => agir(() => api(`/api/categories-controle/${c.id}`, "DELETE"), "Catégorie supprimée")}>
              <Trash2 aria-hidden />
            </Button>
          </div>
          <div className="pl-3">
            <PointsControleEditor categorieId={c.id} points={c.points} />
          </div>
        </div>
      ))}
      <form
        className="flex flex-wrap gap-2 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = nouveau.trim();
          if (v.length < 2) return;
          void agir(async () => {
            await api("/api/categories-controle", "POST", { libelle: v, typeStatuts: type });
            setNouveau("");
          }, "Catégorie ajoutée");
        }}
      >
        <Input aria-label="Nouvelle catégorie de contrôle" placeholder="Nouvelle catégorie…" maxLength={80} className="min-w-48 flex-1" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
        <NativeSelect aria-label="Statuts de la nouvelle catégorie" className="w-48" value={type} onChange={(e) => setType(e.target.value as TypeStatuts)}>
          {TYPES_STATUTS.map((t) => (
            <option key={t} value={t}>
              {LIBELLE_TYPE[t]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={pending || nouveau.trim().length < 2}>
          <Plus aria-hidden />
          Ajouter la catégorie
        </Button>
      </form>
    </div>
  );
}
