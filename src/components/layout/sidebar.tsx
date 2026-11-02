"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BellRing, Box, Calendar, Car, FileText, LayoutDashboard, Megaphone, Receipt, Settings, Tag, Truck, UserCog, Users, Wrench, LogOut, Store,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, users: Users, car: Car, "file-text": FileText, wrench: Wrench,
  calendar: Calendar, box: Box, truck: Truck, receipt: Receipt, tag: Tag, "bar-chart-3": BarChart3, "user-cog": UserCog, megaphone: Megaphone, settings: Settings, "bell-ring": BellRing, store: Store,
};

export interface SidebarItem {
  href: string;
  label: string;
  icon: string;
  group?: string;
  /** Pastille (ex. fiches de contrôle à traiter). */
  badge?: number;
}

interface Props {
  items: SidebarItem[];
  user: { name: string; initials: string; roleLabel: string };
  garage: string;
  ouvert: boolean;
  onNavigate: () => void;
}

export function Sidebar({ items, user, garage, ouvert, onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground px-3 py-4 transition-transform lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
        ouvert ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Pastille blanche : le logo reste lisible sur la barre bleue (Administrateur) ou anthracite (Atelier). */}
      <div className="px-2 pb-5">
        <div className="inline-flex rounded-lg bg-white px-2.5 py-1.5 shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statique */}
          <img src="/logo.svg" alt={APP_NAME} className="h-8 w-auto" />
        </div>
        <div className="mt-2 truncate text-xs text-sidebar-foreground/80" title={garage}>
          {garage}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto" aria-label="Navigation principale">
        {items.map((item, idx) => {
          const Icon = ICONS[item.icon] ?? FileText;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const showGroup = item.group && item.group !== items[idx - 1]?.group;
          return (
            <div key={item.href}>
              {showGroup && (
                <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/85">
                  {item.group}
                </div>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {item.label}
                {!!item.badge && (
                  <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-sidebar-primary-foreground" aria-label={`${item.badge} à traiter`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-sidebar-border pt-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="text-xs text-sidebar-foreground/80">{user.roleLabel}</div>
        </div>
        <button
          type="button"
          aria-label="Se déconnecter"
          title="Se déconnecter"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
