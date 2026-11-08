import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { DELETE as logoDelete, GET as logoGet, POST as logoPost } from "@/app/api/parametres/logo/route";
import { POST as retourPost } from "@/app/api/retours/route";
import { DELETE as retourDelete, PATCH as retourPatch } from "@/app/api/retours/[id]/route";
import { GET as ordresGet } from "@/app/api/retours/ordres/route";
import { POST as piecePost } from "@/app/api/stock/route";
import { PATCH as piecePatch } from "@/app/api/stock/[id]/route";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { pdfDevis } from "@/lib/pdf/devis";
import { garagePdf } from "@/lib/pdf/lignes";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const admin = (): CurrentUser => ({ id: b.user.id, role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" });
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const meca = (): CurrentUser => ({ id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" });

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { host: "localhost", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

/** PNG 1 × 1 valide. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function envoiLogo(contenu: Buffer, nom = "logo.png", type = "image/png") {
  const fd = new FormData();
  fd.append("logo", new File([new Uint8Array(contenu)], nom, { type }));
  return new NextRequest("http://localhost/api/parametres/logo", { method: "POST", headers: { host: "localhost" }, body: fd });
}

function textePdf(pdf: Uint8Array): string {
  let out = "";
  for (const m of Buffer.from(pdf).toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const flux = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      for (const h of flux.matchAll(/<([0-9A-Fa-f]+)>/g)) out += `${Buffer.from(h[1], "hex").toString("latin1")}\n`;
    } catch {
      /* flux binaire */
    }
  }
  return out;
}

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = admin();
});

describe("logo du garage (stocké en base, sans S3)", () => {
  it("enregistre un PNG, le sert en aperçu, l'imprime sur le PDF du devis, puis le retire", async () => {
    const r = await logoPost(envoiLogo(PNG), ctx());
    expect(r.status).toBe(200);
    const g = await db.parametreGarage.findUniqueOrThrow({ where: { id: 1 }, select: { logoData: true, logoMime: true, logoMaj: true, logoUrl: true } });
    expect(g.logoMime).toBe("image/png");
    expect(g.logoMaj).toBeInstanceOf(Date);
    expect(g.logoUrl).toBeNull();
    expect(Buffer.from(g.logoData!).equals(PNG)).toBe(true);

    const apercu = await logoGet(req("/api/parametres/logo"), ctx());
    expect(apercu.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await apercu.arrayBuffer()).equals(PNG)).toBe(true);

    expect((await garagePdf())?.logo?.format).toBe("png");
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    const doc = await pdfDevis(id);
    expect(Buffer.from(doc!.pdf).toString("latin1")).toContain("/Subtype /Image");

    expect((await logoDelete(req("/api/parametres/logo", "DELETE"), ctx())).status).toBe(200);
    expect((await logoGet(req("/api/parametres/logo"), ctx())).status).toBe(404);
  });

  it("le logo n'est pas chargé par les lectures courantes des paramètres", async () => {
    await logoPost(envoiLogo(PNG), ctx());
    const g = await db.parametreGarage.findUniqueOrThrow({ where: { id: 1 } });
    expect("logoData" in g).toBe(false);
  });

  it("refuse un fichier qui n'est pas un PNG ou un JPEG, et le Magasin n'y a pas accès", async () => {
    const gif = Buffer.from("GIF89a-pas-une-image-png");
    const r = await logoPost(envoiLogo(gif, "logo.gif", "image/gif"), ctx());
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("FORMAT_INVALIDE");
    courant = sec();
    expect((await logoPost(envoiLogo(PNG), ctx())).status).toBe(403);
  });
});

describe("PDF du devis en TTC", () => {
  it("affiche les colonnes PU TTC et Total TTC avec les montants TTC", async () => {
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [{ type: "FRAIS_DIVERS", designation: "Frais", quantite: 2, prixUnitaireHT: 50, tvaRate: 20 }] });
    const doc = await pdfDevis(id);
    const t = textePdf(doc!.pdf);
    expect(t).toContain("PU TTC");
    expect(t).toContain("Total TTC");
    expect(t).toMatch(/60,00/); // PU TTC = 50 × 1,2
    expect(t).toMatch(/120,00/); // Total TTC de la ligne
    expect((await PDFDocument.load(doc!.pdf)).getPageCount()).toBe(1);
  });
});

describe("création rapide de pièce", () => {
  it("crée une pièce (Magasin) et refuse un stock initial négatif ; le stock peut ensuite être négatif", async () => {
    courant = sec();
    const corps = { reference: "np1", nom: "Courroie", prixAchatHT: 12, prixVenteHT: 25, stock: 2, seuilAlerte: 0, referencesCroisees: [] };
    const r = await piecePost(req("/api/stock", "POST", corps), ctx());
    expect(r.status).toBe(200);
    const p = (await r.json()).data;
    expect(p).toMatchObject({ reference: "NP1", prixVenteHT: 25, prixAchatHT: 12, stock: 2 });
    expect((await piecePost(req("/api/stock", "POST", { ...corps, reference: "NP2", stock: -1 }), ctx())).status).toBe(400);
    expect((await piecePatch(req(`/api/stock/${p.id}`, "PATCH", { ...corps, stock: -3 }), ctx({ id: p.id }))).status).toBe(200);
  });
});

describe("retours & pièces consignées", () => {
  async function ordre() {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    const r = await validerDevis(id, creneau(b.meca.id));
    return r.ordre!;
  }

  it("crée une consigne rattachée à un OR (le client de l'OR est repris), la traite puis la supprime (admin)", async () => {
    const o = await ordre();
    courant = sec();
    const corps = { type: "CONSIGNE", designation: "Alternateur échange standard", reference: "alt-1", quantite: 1, montantConsigneHT: 80, fournisseur: "Autodistri", ordreId: o.id, pieceId: b.p1.id };
    const r = await retourPost(req("/api/retours", "POST", corps), ctx());
    expect(r.status).toBe(200);
    const { id, numero } = (await r.json()).data;
    expect(numero).toMatch(/^RET-\d{4}-0001$/);
    const cree = await db.retourPiece.findUniqueOrThrow({ where: { id } });
    expect(cree).toMatchObject({ statut: "EN_ATTENTE", clientId: b.client.id, ordreId: o.id, pieceId: b.p1.id, reference: "ALT-1", dateTraitement: null });

    expect((await retourPatch(req(`/api/retours/${id}`, "PATCH", { ...corps, statut: "REMBOURSEE" }), ctx({ id }))).status).toBe(200);
    expect((await db.retourPiece.findUniqueOrThrow({ where: { id } })).dateTraitement).toBeInstanceOf(Date);

    // Recherche d'OR pour le formulaire.
    const liste = await (await ordresGet(req(`/api/retours/ordres?q=${o.numero}`), ctx())).json();
    expect(liste.data).toEqual([expect.objectContaining({ id: o.id, numero: o.numero })]);

    // Suppression : réservée à l'administrateur.
    expect((await retourDelete(req(`/api/retours/${id}`, "DELETE"), ctx({ id }))).status).toBe(403);
    courant = admin();
    expect((await retourDelete(req(`/api/retours/${id}`, "DELETE"), ctx({ id }))).status).toBe(200);
    expect(await db.retourPiece.count()).toBe(0);
  });

  it("refuse un OR d'un autre client, et une saisie sans désignation", async () => {
    const o = await ordre();
    const autre = await db.client.create({ data: { type: "PARTICULIER", firstName: "Autre", lastName: "Client" } });
    const r = await retourPost(req("/api/retours", "POST", { type: "PIECE_DEPOSEE", designation: "Plaquettes usagées", quantite: 1, clientId: autre.id, ordreId: o.id }), ctx());
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("CLIENT_INCOHERENT");
    expect((await retourPost(req("/api/retours", "POST", { type: "PIECE_DEPOSEE", designation: "", quantite: 1 }), ctx())).status).toBe(400);
  });

  it("l'Atelier n'a pas accès aux retours", async () => {
    courant = meca();
    expect((await retourPost(req("/api/retours", "POST", { type: "PIECE_DEPOSEE", designation: "X", quantite: 1 }), ctx())).status).toBe(403);
  });
});
