"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/** Champ de recherche avec liste de résultats (client, pièce…). Recherche différée de 250 ms. */
export function SearchPicker<T>({
  placeholder,
  label,
  fetcher,
  getKey,
  renderItem,
  onPick,
  disabled,
}: {
  placeholder: string;
  label: string;
  fetcher: (q: string) => Promise<T[]>;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    let annule = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetcher(q.trim());
        if (!annule) setItems(r);
      } catch {
        if (!annule) setItems([]);
      } finally {
        if (!annule) setLoading(false);
      }
    }, 250);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [q, open, fetcher]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder={placeholder}
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          role="combobox"
          autoComplete="off"
          className="pl-8"
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {loading && <li className="px-2.5 py-2 text-sm text-muted-foreground">Recherche…</li>}
          {!loading && items.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">Aucun résultat</li>}
          {items.map((it) => (
            <li key={getKey(it)} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(it);
                  setQ("");
                  setOpen(false);
                }}
              >
                {renderItem(it)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
