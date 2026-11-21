import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { POST as piecePost } from "@/app/api/stock/route";
import { PATCH as piecePatch } from "@/app/api/stock/[id]/route";
import { importerPieces } from "@/lib/services/import-pieces";
import { resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { host: "localhost", "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const piece = (reference: string, categorie: string) => ({ reference, nom: "Pièce", prixVenteHT: 10, stock: 1, seuilAlerte: 0, referencesCroisees: [], categorie });
const liste = async () => (await db.categoriePiece.findMany({ orderBy: { position: "asc" } })).map((c) => c.libelle);

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = sec();
  await db.categoriePiece.createMany({ data: [{ libelle: "Freinage", position: 0 }, { libelle: "Éclairage", position: 1 }] });
});

describe("catégorie saisie sur une pièce", () => {
  it("reprend l'écriture de la liste (majuscules, accents)", async () => {
    const r = await piecePost(req("/api/stock", "POST", piece("C1", " freinage ")), ctx());
    expect((await r.json()).data.categorie).toBe("Freinage");
    await piecePost(req("/api/stock", "POST", piece("C2", "ECLAIRAGE")), ctx());
    expect((await db.piece.findUniqueOrThrow({ where: { reference: "C2" } })).categorie).toBe("Éclairage");
    expect(await liste()).toEqual(["Freinage", "Éclairage"]);
  });

  it("ajoute une nouvelle catégorie à la liste des Paramètres (création, modification, import)", async () => {
    await piecePost(req("/api/stock", "POST", piece("C3", "Échappement")), ctx());
    expect(await liste()).toEqual(["Freinage", "Éclairage", "Échappement"]);
    const p = await db.piece.findUniqueOrThrow({ where: { reference: "C3" } });
    await piecePatch(req(`/api/stock/${p.id}`, "PATCH", piece("C3", "Climatisation")), ctx({ id: p.id }));
    expect(await liste()).toEqual(["Freinage", "Éclairage", "Échappement", "Climatisation"]);
    await importerPieces(sec(), [["reference", "nom", "prixVenteHT", "categorie"], ["IMP-1", "Courroie", "8", "Distribution"], ["IMP-2", "Disque", "9", "freinage"]], true);
    expect(await liste()).toEqual(["Freinage", "Éclairage", "Échappement", "Climatisation", "Distribution"]);
    expect((await db.piece.findUniqueOrThrow({ where: { reference: "IMP-2" } })).categorie).toBe("Freinage");
  });

  it("une catégorie vide reste vide", async () => {
    await piecePost(req("/api/stock", "POST", piece("C4", "")), ctx());
    expect((await db.piece.findUniqueOrThrow({ where: { reference: "C4" } })).categorie).toBeNull();
    expect(await liste()).toHaveLength(2);
  });
});
