"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Recherche globale : renvoie vers la liste des clients filtrée (nom, plaque, téléphone). */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="flex max-w-md flex-1 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/clients?q=${encodeURIComponent(v)}`);
      }}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <input
        aria-label="Rechercher un client, une plaque, un téléphone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={100}
        placeholder="Rechercher un client, une plaque, un devis…"
        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}
