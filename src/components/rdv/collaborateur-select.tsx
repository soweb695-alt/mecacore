"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CollaborateurOption {
  id: string;
  nom: string;
  couleur: string;
}

/** Menu déroulant des collaborateurs : un petit carré de leur couleur attitrée précède chaque nom. */
export function CollaborateurSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: CollaborateurOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const racine = useRef<HTMLDivElement>(null);
  const listeId = useId();
  const choisi = options.find((o) => o.id === value);

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, []);

  function ouvrir() {
    setActif(Math.max(0, options.findIndex((o) => o.id === value)));
    setOuvert(true);
  }

  function clavier(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOuvert(false);
    if (!ouvert && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      return ouvrir();
    }
    if (!ouvert) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[actif]) onChange(options[actif].id);
      setOuvert(false);
    }
  }

  return (
    <div ref={racine} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={listeId}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={clavier}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {choisi ? (
          <>
            <span className="size-3 shrink-0 rounded-[3px]" style={{ background: choisi.couleur }} aria-hidden />
            <span className="flex-1 truncate">{choisi.nom}</span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">Choisir un collaborateur…</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {ouvert && (
        <ul id={listeId} role="listbox" aria-label={label} className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {options.map((o, i) => (
            <li key={o.id} role="option" aria-selected={o.id === value}>
              <button
                type="button"
                tabIndex={-1}
                className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", i === actif && "bg-muted")}
                onMouseEnter={() => setActif(i)}
                onClick={() => {
                  onChange(o.id);
                  setOuvert(false);
                }}
              >
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: o.couleur }} aria-hidden />
                <span className="flex-1 truncate">{o.nom}</span>
                {o.id === value && <Check className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
