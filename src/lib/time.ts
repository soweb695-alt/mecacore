// Gestion des fuseaux : toutes les dates sont stockées en UTC, saisies et affichées en Europe/Paris.
const TZ = "Europe/Paris";

function partsInTz(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Décalage (ms) entre l'heure de Paris et UTC à l'instant donné. */
function offsetMs(d: Date): number {
  const p = partsInTz(d);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-10-25T14:30" (heure de Paris) → instant UTC. */
export function parisVersUtc(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Date invalide");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off1 = offsetMs(new Date(guess));
  const off2 = offsetMs(new Date(guess - off1));
  return new Date(guess - off2);
}

/** Instant UTC → "YYYY-MM-DDTHH:mm" en heure de Paris. */
export function utcVersParis(d: Date): string {
  const p = partsInTz(d);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

/** "YYYY-MM-DD" du jour courant à Paris. */
export function jourParis(d = new Date()): string {
  return utcVersParis(d).slice(0, 10);
}

/** Lundi (YYYY-MM-DD) de la semaine contenant la date donnée. */
export function lundiDe(jour: string): string {
  const [y, m, d] = jour.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export function ajouterJoursStr(jour: string, n: number): string {
  const [y, m, d] = jour.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
