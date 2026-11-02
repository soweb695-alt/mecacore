import { describe, expect, it } from "vitest";
import { cellule, versCsv } from "@/lib/csv";

describe("export CSV", () => {
  it("neutralise l'injection de formules", () => {
    for (const v of ["=1+1", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)"]) expect(cellule(v).startsWith("'") || cellule(v).startsWith('"\'')).toBe(true);
  });
  it("échappe les séparateurs, guillemets et retours à la ligne", () => {
    expect(cellule('a;b')).toBe('"a;b"');
    expect(cellule('dit "oui"')).toBe('"dit ""oui"""');
    expect(cellule("l1\nl2")).toBe('"l1\nl2"');
  });
  it("écrit les nombres avec la virgule décimale française", () => {
    expect(cellule(12.5)).toBe("12,5");
    expect(cellule(null)).toBe("");
  });
  it("produit un fichier avec BOM, séparateur ; et CRLF", () => {
    const csv = versCsv(["A", "B"], [[1, "x"]]);
    expect(csv.startsWith("﻿A;B\r\n")).toBe(true);
    expect(csv.endsWith("1;x\r\n")).toBe(true);
  });
});
