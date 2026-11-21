"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Minuscules sans accents : « Éclairage » est trouvé en tapant « ecl ». */
const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Suggestions pour un texte saisi : celles qui commencent par le texte d'abord, puis celles qui le contiennent. */
export function filtrerSuggestions(suggestions: string[], saisie: string, max = 8): string[] {
  const q = normaliser(saisie);
  if (!q) return suggestions.slice(0, max);
  const debut = suggestions.filter((s) => normaliser(s).startsWith(q));
  const contient = suggestions.filter((s) => !debut.includes(s) && normaliser(s).includes(q));
  return [...debut, ...contient].slice(0, max);
}

/**
 * Champ texte avec propositions au fil de la frappe (combobox accessible) : flèches haut / bas pour choisir,
 * Entrée pour valider, Échap pour fermer. Le texte reste libre.
 */
export function AutocompleteInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  invalid,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  invalid?: boolean;
  maxLength?: number;
}) {
  const listId = useId();
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const propositions = filtrerSuggestions(suggestions, value).filter((s) => s !== value);
  const visible = ouvert && propositions.length > 0;

  function choisir(s: string) {
    onChange(s);
    setOuvert(false);
    setActif(-1);
  }

  function clavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif((a) => Math.min(a + 1, propositions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && visible && actif >= 0) {
      e.preventDefault();
      choisir(propositions[actif]);
    } else if (e.key === "Escape" && visible) {
      e.preventDefault();
      setOuvert(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={visible && actif >= 0 ? `${listId}-${actif}` : undefined}
        aria-invalid={invalid}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOuvert(true);
          setActif(0);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setOuvert(false)}
        onKeyDown={clavier}
      />
      {visible && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-md">
          {propositions.map((s, i) => (
            <li
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === actif}
              // onMouseDown : le choix est pris avant que le champ ne perde le focus.
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(s);
              }}
              onMouseEnter={() => setActif(i)}
              className={cn("cursor-pointer rounded-md px-2.5 py-1.5", i === actif && "bg-muted")}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
