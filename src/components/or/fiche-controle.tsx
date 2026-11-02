"use client";

import { CheckCircle2, ClipboardCheck, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge, type Tone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Resultat = "NON_VERIFIE" | "OK" | "A_SURVEILLER" | "DEFAUT";
type StatutFiche = "EN_COURS" | "TRANSMISE" | "TRAITEE";

export const LIBELLE_RESULTAT: Record<Resultat, string> = { NON_VERIFIE: "Non vérifié", OK: "OK", A_SURVEILLER: "À surveiller", DEFAUT: "Défaut" };
const TONE_RESULTAT: Record<Resultat, Tone> = { NON_VERIFIE: "neutral", OK: "ok", A_SURVEILLER: "warn", DEFAUT: "danger" };
const LIBELLE_STATUT: Record<StatutFiche, string> = { EN_COURS: "En cours de saisie", TRANSMISE: "Transmise au Magasin", TRAITEE: "Traitée" };
const TONE_STATUT: Record<StatutFiche, Tone> = { EN_COURS: "neutral", TRANSMISE: "warn", TRAITEE: "ok" };

const CHOIX: { v: Exclude<Resultat, "NON_VERIFIE">; classe: string }[] = [
  { v: "OK", classe: "data-[on=true]:bg-success data-[on=true]:text-white" },
  { v: "A_SURVEILLER", classe: "data-[on=true]:bg-warning data-[on=true]:text-white" },
  { v: "DEFAUT", classe: "data-[on=true]:bg-destructive data-[on=true]:text-white" },
];

export function FicheControle({
  ordreId,
  statut,
  points,
  remarques,
  validee,
  peutRemplir,
  peutTraiter,
}: {
  ordreId: string;
  statut: StatutFiche;
  points: { id: string; libelle: string; resultat: Resultat }[];
  remarques: string;
  /** « le 26/10 à 14:30 par Karim » quand la fiche a été transmise. */
  validee: string | null;
  peutRemplir: boolean;
  peutTraiter: boolean;
}) {
  const router = useRouter();
  const editable = peutRemplir && statut === "EN_COURS";
  const [res, setRes] = useState<Record<string, Resultat>>(Object.fromEntries(points.map((p) => [p.id, p.resultat])));
  const [notes, setNotes] = useState(remarques);
  const [pending, setPending] = useState(false);
  const manquants = points.filter((p) => res[p.id] === "NON_VERIFIE").length;

  async function appeler(fn: () => Promise<unknown>, ok: string) {
    setPending(true);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }
  const sauver = (valider: boolean) =>
    appeler(() => api(`/api/ordres-reparation/${ordreId}/fiche`, "PUT", { points: points.map((p) => ({ id: p.id, resultat: res[p.id] })), remarques: notes, valider }), valider ? "Fiche transmise au Magasin" : "Fiche enregistrée");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5" aria-hidden />
          Fiche de contrôle
        </CardTitle>
        <StatusBadge tone={TONE_STATUT[statut]}>{LIBELLE_STATUT[statut]}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-4">
        {points.length === 0 && <p className="text-sm text-muted-foreground">Aucun point de contrôle n&apos;est paramétré.</p>}
        <ul className="divide-y">
          {points.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="text-sm font-medium">{p.libelle}</span>
              {editable ? (
                <div role="group" aria-label={p.libelle} className="flex gap-1">
                  {CHOIX.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      data-on={res[p.id] === c.v}
                      aria-pressed={res[p.id] === c.v}
                      disabled={pending}
                      onClick={() => setRes((r) => ({ ...r, [p.id]: c.v }))}
                      className={cn("min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted data-[on=true]:border-transparent", c.classe)}
                    >
                      {LIBELLE_RESULTAT[c.v]}
                    </button>
                  ))}
                </div>
              ) : (
                <StatusBadge tone={TONE_RESULTAT[res[p.id]]}>{LIBELLE_RESULTAT[res[p.id]]}</StatusBadge>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-1.5">
          <label htmlFor="fiche-remarques" className="text-sm font-medium">
            Remarques
          </label>
          {editable ? (
            <Textarea id="fiche-remarques" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Points d'attention, pièces à prévoir, conseils au client…" />
          ) : (
            <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">{notes || "Aucune remarque."}</p>
          )}
        </div>
        {validee && <p className="text-xs text-muted-foreground">Transmise {validee}.</p>}
        {editable && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {manquants > 0 && <span className="mr-auto text-xs text-muted-foreground">{manquants} point{manquants > 1 ? "s" : ""} à renseigner pour valider</span>}
            <Button variant="outline" disabled={pending} onClick={() => sauver(false)}>
              Enregistrer
            </Button>
            <Button disabled={pending || manquants > 0} onClick={() => sauver(true)}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
              Valider et transmettre au Magasin
            </Button>
          </div>
        )}
        {peutTraiter && statut === "TRANSMISE" && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => appeler(() => api(`/api/ordres-reparation/${ordreId}/fiche/renvoyer`, "POST"), "Fiche renvoyée à l'atelier")}>
              <Undo2 aria-hidden />
              Renvoyer à l&apos;atelier
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
