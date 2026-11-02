"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCloseDialog } from "@/components/forms/form-dialog";
import { StatusBadge, type Tone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { COLONNES_IMPORT } from "@/lib/import-pieces";

interface Ligne {
  ligne: number;
  reference: string;
  action: "creer" | "maj" | "erreur";
  messages: string[];
}
interface Resultat {
  appliquee: boolean;
  erreurFichier?: string;
  lignes: Ligne[];
  crees: number;
  misAJour: number;
  erreurs: number;
  avertissements: string[];
}

const TONE: Record<Ligne["action"], Tone> = { creer: "ok", maj: "info", erreur: "danger" };
const LIBELLE: Record<Ligne["action"], string> = { creer: "Création", maj: "Mise à jour", erreur: "Erreur" };

/** Import en deux temps : aperçu (rien n'est écrit), puis import des lignes valides. */
export function ImportPieces({ avecAchat }: { avecAchat: boolean }) {
  const router = useRouter();
  const close = useCloseDialog();
  const input = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const colonnes = COLONNES_IMPORT.filter((c) => avecAchat || c.cle !== "prixAchatHT");

  async function envoyer(mode: "apercu" | "importer") {
    if (!fichier) return;
    setPending(true);
    setErreur(null);
    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      fd.append("mode", mode);
      const res = await fetch("/api/stock/import", { method: "POST", body: fd, credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Import impossible.");
      const r = json.data as Resultat;
      setResultat(r);
      if (r.erreurFichier) setErreur(r.erreurFichier);
      if (mode === "importer") {
        toast.success(`${r.crees} pièce${r.crees > 1 ? "s" : ""} créée${r.crees > 1 ? "s" : ""}, ${r.misAJour} mise${r.misAJour > 1 ? "s" : ""} à jour${r.erreurs ? `, ${r.erreurs} ligne${r.erreurs > 1 ? "s" : ""} en erreur` : ""}`);
        router.refresh();
        if (r.erreurs === 0) close();
      }
    } catch (e) {
      setResultat(null);
      setErreur(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setPending(false);
    }
  }

  const valides = resultat ? resultat.crees + resultat.misAJour : 0;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1.5 font-medium">Format attendu</p>
        <p className="mb-2 text-muted-foreground">
          Fichier Excel (.xlsx) ou CSV, avec les titres de colonnes en première ligne. Une référence déjà présente met la pièce à jour ; le stock saisi est <b>ajouté</b> au stock actuel.
        </p>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <tbody>
              {colonnes.map((c) => (
                <tr key={c.cle} className="border-b last:border-0">
                  <td className="w-44 bg-muted/50 px-2.5 py-1.5 font-medium">
                    {c.titre}
                    {c.obligatoire && <span className="text-destructive"> *</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{c.aide || "Facultatif."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Modèle à compléter :{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier */}
          <a className="text-link hover:underline" href="/api/stock/export?modele=1&format=xlsx">
            Excel
          </a>{" "}
          ·{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier */}
          <a className="text-link hover:underline" href="/api/stock/export?modele=1&format=csv">
            CSV
          </a>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Choisir un fichier à importer"
          onChange={(e) => {
            setFichier(e.target.files?.[0] ?? null);
            setResultat(null);
            setErreur(null);
          }}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          <FileSpreadsheet aria-hidden />
          {fichier ? fichier.name : "Choisir un fichier"}
        </Button>
        <Button type="button" disabled={!fichier || pending} onClick={() => envoyer("apercu")}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Analyser le fichier
        </Button>
      </div>

      {erreur && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-destructive">
          {erreur}
        </p>
      )}

      {resultat && !resultat.erreurFichier && (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="ok">{resultat.crees} à créer</StatusBadge>
            <StatusBadge tone="info">{resultat.misAJour} à mettre à jour</StatusBadge>
            <StatusBadge tone={resultat.erreurs ? "danger" : "neutral"}>{resultat.erreurs} en erreur</StatusBadge>
          </p>
          {resultat.avertissements.map((a) => (
            <p key={a} className="rounded-lg bg-warning-bg px-3 py-2 text-warning">
              {a}
            </p>
          ))}
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Ligne</th>
                  <th className="px-2.5 py-1.5 font-medium">Référence</th>
                  <th className="px-2.5 py-1.5 font-medium">Action</th>
                  <th className="px-2.5 py-1.5 font-medium">Détail</th>
                </tr>
              </thead>
              <tbody>
                {resultat.lignes.map((l) => (
                  <tr key={l.ligne} className="border-t align-top">
                    <td className="px-2.5 py-1.5">{l.ligne}</td>
                    <td className="px-2.5 py-1.5 font-medium">{l.reference || "–"}</td>
                    <td className="px-2.5 py-1.5">
                      <StatusBadge tone={TONE[l.action]}>{LIBELLE[l.action]}</StatusBadge>
                    </td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{l.messages.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!resultat.appliquee && (
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={close}>
                Annuler
              </Button>
              <Button type="button" disabled={valides === 0 || pending} onClick={() => envoyer("importer")}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                Importer {valides} ligne{valides > 1 ? "s" : ""} valide{valides > 1 ? "s" : ""}
              </Button>
            </div>
          )}
          {resultat.appliquee && (
            <div className="flex justify-end">
              <Button type="button" onClick={close}>
                Fermer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
