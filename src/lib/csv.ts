/**
 * CSV compatible Excel français : séparateur « ; », BOM UTF-8, fin de ligne CRLF.
 * Les cellules commençant par = + - @ (ou tabulation) sont neutralisées contre l'injection de formules.
 */
export function cellule(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(v).replace(".", ",") : v;
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function versCsv(entetes: string[], lignes: (string | number | null | undefined)[][]): string {
  return "﻿" + [entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n";
}
