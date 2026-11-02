"use client";

import { ArrowLeft, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { GlobalSearch } from "@/components/layout/global-search";
import { Sidebar, type SidebarItem } from "@/components/layout/sidebar";
import type { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface Props {
  items: SidebarItem[];
  user: { name: string; initials: string; roleLabel: string };
  role: Role;
  garage: string;
  children: React.ReactNode;
}

/** Cadre de l'application : barre latérale fixe en grand écran, tiroir sur tablette (< 1024 px). */
export function AppShell({ items, user, role, garage, children }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // Pas de flèche de retour sur la page d'accueil de chaque rôle.
  const accueil = pathname === "/dashboard" || pathname === "/ordres-reparation";
  return (
    <div className="flex min-h-screen">
      <div
        className={cn("fixed inset-0 z-30 bg-black/30 lg:hidden", ouvert ? "block" : "hidden")}
        aria-hidden
        onClick={() => setOuvert(false)}
      />
      <Sidebar items={items} user={user} garage={garage} ouvert={ouvert} onNavigate={() => setOuvert(false)} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card px-4 py-3 lg:px-7">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-muted lg:hidden"
            aria-label="Ouvrir le menu"
            aria-expanded={ouvert}
            onClick={() => setOuvert(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>
          {!accueil && (
            <button
              type="button"
              className="rounded-lg p-2 text-foreground hover:bg-muted"
              aria-label="Retour à la page précédente"
              title="Retour"
              onClick={() => router.back()}
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          )}
          {role !== "MECANICIEN" ? <GlobalSearch /> : <div className="flex-1" />}
        </header>
        <main className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
