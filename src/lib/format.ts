const TZ = "Europe/Paris";

export const eur = (n: number | string | { toString(): string }): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n.toString()));

export const dateFR = (d: Date | string | null | undefined): string =>
  d ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "short" }).format(new Date(d)) : "–";

export const dateLongueFR = (d: Date | string): string =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, dateStyle: "full" }).format(new Date(d));

export const heureFR = (d: Date | string): string =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d));

export const dateHeureFR = (d: Date | string): string => `${dateFR(d)} ${heureFR(d)}`;

export function nomClient(c: { type: string; firstName: string | null; lastName: string | null; companyName: string | null }): string {
  if (c.type === "PRO" && c.companyName) return c.companyName;
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || c.companyName || "Client";
}

export function dureeHMS(secondes: number): string {
  const s = Math.max(0, Math.floor(secondes));
  const f = (n: number) => String(n).padStart(2, "0");
  return `${f(Math.floor(s / 3600))}:${f(Math.floor((s % 3600) / 60))}:${f(s % 60)}`;
}

/** Nombre de jours écoulés depuis une date. */
export const joursDepuis = (d: Date | string): number => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5));

/** Date située `n` jours dans le futur (n négatif : dans le passé). */
export const dansJours = (n: number): Date => new Date(Date.now() + n * 864e5);
