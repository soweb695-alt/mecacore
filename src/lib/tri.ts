/** Tri d'une liste paginée par le serveur, lu dans l'URL (?tri=colonne&ordre=asc|desc) et limité aux colonnes autorisées. */
export type Ordre = "asc" | "desc";

export function lireTri<T>(sp: { tri?: string; ordre?: string }, colonnes: Record<string, (o: Ordre) => T>, defaut: T): { tri?: string; ordre?: Ordre; orderBy: T } {
  const ordre: Ordre = sp.ordre === "desc" ? "desc" : "asc";
  const f = sp.tri && Object.hasOwn(colonnes, sp.tri) ? colonnes[sp.tri] : undefined;
  return f ? { tri: sp.tri, ordre, orderBy: f(ordre) } : { orderBy: defaut };
}
