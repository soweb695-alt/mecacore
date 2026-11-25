"use client";

import { FileText, PackageMinus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";

/** Pièce du stock rattachée au descriptif : déduite du stock comme une pièce de forfait (× quantité de la ligne). */
export interface PieceDescriptif {
  pieceId: string;
  reference: string;
  nom: string;
  quantite: number;
}

interface PieceTrouvee {
  id: string;
  reference: string;
  nom: string;
  referenceCroisee?: string | null;
  stock: number;
}

/** Mot sous le curseur (référence en cours de saisie : lettres, chiffres, tirets, points, barres). */
export function motAuCurseur(texte: string, pos: number): string {
  const avant = texte.slice(0, pos).match(/[\p{L}\p{N}\-_./]+$/u)?.[0] ?? "";
  const apres = texte.slice(pos).match(/^[\p{L}\p{N}\-_./]+/u)?.[0] ?? "";
  return avant + apres;
}

const normaliser = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Pièces dont la référence (ou la référence croisée) contient le mot saisi : jamais une simple ressemblance de nom. */
export function correspondReference(mot: string, p: { reference: string; referenceCroisee?: string | null }): boolean {
  const m = normaliser(mot);
  return m.length >= 3 && [p.reference, p.referenceCroisee ?? ""].some((r) => normaliser(r).includes(m));
}

/**
 * Descriptif d'une ligne de devis ou de facture : pré-rempli depuis le tarif (forfait vidange…), modifiable pour ce
 * document uniquement, imprimé sous la désignation sur le PDF. Replié par défaut quand il est vide.
 * Une référence du stock tapée dans le texte est proposée : un clic la rattache à la ligne et elle sera déduite du stock.
 */
export function DescriptifLigne({
  valeur,
  onChange,
  designation,
  pieces = [],
  onPiecesChange,
  moment = "à la validation du devis",
}: {
  valeur: string;
  onChange: (v: string) => void;
  designation: string;
  pieces?: PieceDescriptif[];
  /** Absent : pas de rattachement au stock. */
  onPiecesChange?: (p: PieceDescriptif[]) => void;
  /** Moment où le stock est déduit (affiché à l'utilisateur). */
  moment?: string;
}) {
  const [ouvert, setOuvert] = useState(valeur.trim() !== "" || pieces.length > 0);
  const [mot, setMot] = useState("");
  const [suggestions, setSuggestions] = useState<PieceTrouvee[]>([]);
  const requete = useRef(0);

  useEffect(() => {
    if (!onPiecesChange || normaliser(mot).length < 3) return;
    const n = ++requete.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<{ items: PieceTrouvee[] }>(`/api/stock?q=${encodeURIComponent(mot)}`, "GET");
        if (n === requete.current) setSuggestions(r.items.filter((p) => correspondReference(mot, p)).slice(0, 5));
      } catch {
        if (n === requete.current) setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [mot, onPiecesChange]);

  const proposees = normaliser(mot).length >= 3 ? suggestions.filter((s) => !pieces.some((p) => p.pieceId === s.id)) : [];

  function suivreCurseur(el: HTMLTextAreaElement) {
    setMot(motAuCurseur(el.value, el.selectionStart ?? el.value.length));
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        <FileText className="size-3" aria-hidden />
        Ajouter un descriptif
      </button>
    );
  }
  return (
    <div className="mt-1 space-y-1">
      <div className="relative">
        <Textarea
          aria-label={`Descriptif de ${designation || "la ligne"}`}
          value={valeur}
          maxLength={1500}
          rows={Math.min(6, Math.max(2, valeur.split("\n").length + Math.floor(valeur.length / 70)))}
          placeholder={onPiecesChange ? "Détail des travaux, références des pièces… (imprimé sous la ligne)" : "Détail des travaux, conditions, remarques… (imprimé sous la ligne)"}
          className="min-h-0 pr-7 text-xs"
          onChange={(e) => {
            onChange(e.target.value);
            suivreCurseur(e.target);
          }}
          onClick={(e) => suivreCurseur(e.currentTarget)}
          onKeyUp={(e) => suivreCurseur(e.currentTarget)}
        />
        <button
          type="button"
          aria-label="Retirer le descriptif"
          title="Retirer le descriptif"
          className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
          onClick={() => {
            onChange("");
            onPiecesChange?.([]);
            setMot("");
            setOuvert(false);
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {onPiecesChange && proposees.length > 0 && (
        <div role="group" aria-label="Pièces du stock correspondant à la référence" className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-1.5">
          <p className="px-1 pb-1 text-[11px] text-muted-foreground">Référence du stock reconnue : cliquez pour la déduire du stock {moment}.</p>
          <ul className="space-y-0.5">
            {proposees.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-primary/10"
                  onClick={() => {
                    onPiecesChange([...pieces, { pieceId: p.id, reference: p.reference, nom: p.nom, quantite: 1 }]);
                    setMot("");
                  }}
                >
                  <span>
                    <PackageMinus className="mr-1 inline size-3.5 text-primary" aria-hidden />
                    Rattacher <b>{p.reference}</b> · {p.nom}
                  </span>
                  <span className={p.stock <= 0 ? "text-destructive" : "text-muted-foreground"}>stock {p.stock}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onPiecesChange && pieces.length > 0 && (
        <div className="rounded-md bg-muted/60 px-2 py-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Pièces sorties du stock {moment} (× quantité de la ligne) :</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {pieces.map((p, i) => (
              <li key={p.pieceId} className="flex items-center gap-1 rounded border bg-background py-0.5 pl-2 pr-1 text-xs">
                <span>
                  <b>{p.reference}</b> · {p.nom} ×
                </span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                  aria-label={`Quantité de ${p.reference}`}
                  className="w-12 rounded border px-1 py-0.5 text-xs"
                  value={p.quantite}
                  onChange={(e) => {
                    const q = Math.max(1, Math.min(1000, Math.trunc(Number(e.target.value) || 1)));
                    onPiecesChange(pieces.map((x, j) => (j === i ? { ...x, quantite: q } : x)));
                  }}
                />
                <button type="button" aria-label={`Ne plus déduire ${p.reference} du stock`} title="Ne plus déduire du stock" className="rounded p-0.5 text-muted-foreground hover:bg-muted" onClick={() => onPiecesChange(pieces.filter((_, j) => j !== i))}>
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
