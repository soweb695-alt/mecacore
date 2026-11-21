import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { PUT as fichePut } from "@/app/api/ordres-reparation/[id]/fiche/route";
import { POST as ficheVerifier } from "@/app/api/ordres-reparation/[id]/fiche/verifier/route";
import { POST as ficheRenvoyer } from "@/app/api/ordres-reparation/[id]/fiche/renvoyer/route";
import { GET as fichePdf } from "@/app/api/ordres-reparation/[id]/fiche/pdf/route";
import { GET as ficheSignature } from "@/app/api/ordres-reparation/[id]/fiche/signature/route";
import { POST as categoriePost } from "@/app/api/categories-controle/route";
import { DELETE as categorieDelete, PATCH as categoriePatch } from "@/app/api/categories-controle/[id]/route";
import { POST as pointPost } from "@/app/api/points-controle/route";
import { PATCH as pointPatch } from "@/app/api/points-controle/[id]/route";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { obtenirFiche } from "@/lib/services/fiche-controle";
import { creneau, EXAMINANT, resetDb, seedBase, SIGNATURE_PNG } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const admin = (): CurrentUser => ({ id: b.user.id, role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" });
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const meca = (): CurrentUser => ({ id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" });

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { host: "localhost", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

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

/** Modèle de la migration : quatre catégories, une par type de statuts. */
async function modeleParDefaut() {
  const cats = [
    { libelle: "État des pneus", typeStatuts: "OK_ABIME" as const, points: ["Pneu AV/G", "Pneu AV/D", "Pneu AR/G", "Pneu AR/D"] },
    { libelle: "Contrôle des niveaux", typeStatuts: "OK_NC" as const, points: ["Niveau d'huile", "Carburant"] },
    { libelle: "Éléments du véhicule", typeStatuts: "OK_A_REPARER" as const, points: ["Phare avant", "Fanion"] },
    { libelle: "Papiers / accessoires de bord", typeStatuts: "CASE" as const, points: ["Carte grise", "Cric"] },
  ];
  for (const [i, c] of cats.entries()) {
    await db.categorieControle.create({ data: { libelle: c.libelle, typeStatuts: c.typeStatuts, position: i, points: { create: c.points.map((libelle, position) => ({ libelle, position })) } } });
  }
}

async function ordre() {
  const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, kilometrage: 84_200, lignes: [{ type: "MAIN_OEUVRE", designation: "Révision", quantite: 1, prixUnitaireHT: 60, tvaRate: 20 }] });
  const r = await validerDevis(id, creneau(b.meca.id));
  return r.ordre!.id;
}

/** Réponses complètes : OK partout, un pneu abîmé, le fanion « non concerné », le cric absent (case décochée). */
function reponses(points: { id: string; libelle: string }[]) {
  return points.map((p) => ({ id: p.id, resultat: p.libelle === "Pneu AV/G" ? "ABIME" : p.libelle === "Fanion" ? "NON_CONCERNE" : p.libelle === "Cric" ? "NON_VERIFIE" : "OK" }));
}

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  await modeleParDefaut();
  courant = meca();
});

describe("fiche de contrôle par catégories", () => {
  it("copie les catégories, leur type de statuts et leurs points dans l'ordre du modèle", async () => {
    const f = await obtenirFiche(await ordre());
    expect(f.version).toBe(2);
    expect(f.points.map((p) => p.categorie)).toEqual([...Array(4).fill("État des pneus"), ...Array(2).fill("Contrôle des niveaux"), ...Array(2).fill("Éléments du véhicule"), ...Array(2).fill("Papiers / accessoires de bord")]);
    expect(f.points[0]).toMatchObject({ libelle: "Pneu AV/G", typeStatuts: "OK_ABIME", resultat: "NON_VERIFIE" });
  });

  it("refuse un statut qui n'appartient pas au type de la catégorie", async () => {
    const id = await ordre();
    const f = await obtenirFiche(id);
    const pneu = f.points.find((p) => p.libelle === "Pneu AV/G")!;
    const r = await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: [{ id: pneu.id, resultat: "A_REPARER" }], remarques: "", valider: false }), ctx({ id }));
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("RESULTAT_INVALIDE");
    const carte = f.points.find((p) => p.libelle === "Carte grise")!;
    expect((await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: [{ id: carte.id, resultat: "NON_CONCERNE" }], remarques: "", valider: false }), ctx({ id }))).status).toBe(400);
  });

  it("validation : tous les points renseignés (une case décochée compte) et nom, prénom, signature de l'examinant", async () => {
    const id = await ordre();
    const f = await obtenirFiche(id);
    const complet = reponses(f.points);
    // Un pneu sans réponse : incomplet.
    const incomplet = complet.map((p, i) => (i === 1 ? { ...p, resultat: "NON_VERIFIE" } : p));
    expect((await (await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: incomplet, remarques: "", valider: true, examinant: EXAMINANT }), ctx({ id }))).json()).error.code).toBe("FICHE_INCOMPLETE");
    // Sans signature : refusé.
    expect((await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: complet, remarques: "", valider: true, examinant: { nom: "Amrani", prenom: "Youssef" } }), ctx({ id }))).status).toBe(400);
    // Brouillon : croquis et nom enregistrés, pas de signature exigée.
    const croquis = [{ x: 0.82, y: 0.3 }, { x: 0.2, y: 0.7 }];
    expect((await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: complet, remarques: "Rayure aile AV/D", dommages: croquis, valider: false, examinant: { nom: "Amrani", prenom: "Youssef" } }), ctx({ id }))).status).toBe(200);
    expect(await db.ficheControle.findUniqueOrThrow({ where: { ordreId: id } })).toMatchObject({ statut: "EN_COURS", dommages: croquis, examinantNom: "Amrani", examinantPrenom: "Youssef" });
    // Validation complète.
    expect((await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: complet, remarques: "Rayure aile AV/D", dommages: croquis, valider: true, examinant: { nom: "Amrani", prenom: "Youssef", signature: SIGNATURE_PNG } }), ctx({ id }))).status).toBe(200);
    const apres = await db.ficheControle.findUniqueOrThrow({ where: { ordreId: id }, select: { statut: true, examinantSignature: true } });
    expect(apres.statut).toBe("TRANSMISE");
    expect(apres.examinantSignature?.length).toBeGreaterThan(50);
    const img = await ficheSignature(req(`/api/ordres-reparation/${id}/fiche/signature?qui=examinant`), ctx({ id }));
    expect(img.headers.get("content-type")).toBe("image/png");
  });

  it("vérification du responsable : Magasin uniquement, après la validation ; un renvoi efface les signatures", async () => {
    const id = await ordre();
    const f = await obtenirFiche(id);
    const corps = { nom: "Karim Martin", signature: SIGNATURE_PNG };
    courant = sec();
    expect((await ficheVerifier(req(`/api/ordres-reparation/${id}/fiche/verifier`, "POST", corps), ctx({ id }))).status).toBe(409);
    courant = meca();
    await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: reponses(f.points), remarques: "", valider: true, examinant: EXAMINANT }), ctx({ id }));
    expect((await ficheVerifier(req(`/api/ordres-reparation/${id}/fiche/verifier`, "POST", corps), ctx({ id }))).status).toBe(403);
    courant = sec();
    expect((await ficheVerifier(req(`/api/ordres-reparation/${id}/fiche/verifier`, "POST", corps), ctx({ id }))).status).toBe(200);
    const v = await db.ficheControle.findUniqueOrThrow({ where: { ordreId: id }, select: { responsableNom: true, responsableSignature: true, verifieeLe: true } });
    expect(v.responsableNom).toBe("Karim Martin");
    expect(v.verifieeLe).toBeInstanceOf(Date);
    expect(v.responsableSignature).not.toBeNull();

    expect((await ficheRenvoyer(req(`/api/ordres-reparation/${id}/fiche/renvoyer`, "POST"), ctx({ id }))).status).toBe(200);
    const r = await db.ficheControle.findUniqueOrThrow({ where: { ordreId: id }, select: { statut: true, examinantSignature: true, responsableSignature: true, verifieeLe: true } });
    expect(r).toMatchObject({ statut: "EN_COURS", examinantSignature: null, responsableSignature: null, verifieeLe: null });
  });

  it("PDF « Imprimer la fiche » : en-tête, colonnes de statut, croquis, observations et signatures", async () => {
    const id = await ordre();
    const f = await obtenirFiche(id);
    await fichePut(req(`/api/ordres-reparation/${id}/fiche`, "PUT", { points: reponses(f.points), remarques: "Rayure aile avant droite", dommages: [{ x: 0.8, y: 0.25 }], valider: true, examinant: { nom: "Amrani", prenom: "Youssef", signature: SIGNATURE_PNG } }), ctx({ id }));
    courant = sec();
    await ficheVerifier(req(`/api/ordres-reparation/${id}/fiche/verifier`, "POST", { nom: "Karim Martin", signature: SIGNATURE_PNG }), ctx({ id }));
    const r = await fichePdf(req(`/api/ordres-reparation/${id}/fiche/pdf`), ctx({ id }));
    expect(r.headers.get("content-type")).toBe("application/pdf");
    const pdf = new Uint8Array(await r.arrayBuffer());
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    const t = textePdf(pdf);
    for (const attendu of ["FICHE DE CONTR", "Garage Test", "IMMATRICULATION", "AB-123-CD", "Peugeot 308", "84", "TAT DES PNEUS", "Ab", "N.C.", "parer", "N/A", "Pneu AV/G", "Carte grise", "CROQUIS", "OBSERVATIONS", "Rayure aile avant droite", "examinant", "Youssef Amrani", "rification du responsable", "Karim Martin"]) {
      expect(t, attendu).toContain(attendu);
    }
    // Les deux signatures sont intégrées comme images.
    expect(Buffer.from(pdf).toString("latin1").match(/\/Subtype \/Image/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("un mécanicien d'un autre OR ne peut pas imprimer la fiche", async () => {
    const id = await ordre();
    const autre = await db.user.create({ data: { email: "m3@test.fr", passwordHash: "x", firstName: "Autre", lastName: "Meca", role: "MECANICIEN" } });
    courant = { id: autre.id, role: "MECANICIEN", email: "m3@test.fr", firstName: "A", lastName: "M" };
    expect((await fichePdf(req(`/api/ordres-reparation/${id}/fiche/pdf`), ctx({ id }))).status).toBe(403);
  });

  it("une fiche de l'ancien modèle reste lisible et imprimable dans son format", async () => {
    const id = await ordre();
    await db.ficheControle.create({ data: { ordreId: id, version: 1, statut: "TRANSMISE", points: { create: [{ libelle: "Freins", resultat: "A_SURVEILLER" }] } } });
    const f = await obtenirFiche(id);
    expect(f.version).toBe(1);
    const t = textePdf(new Uint8Array(await (await fichePdf(req(`/api/ordres-reparation/${id}/fiche/pdf`), ctx({ id }))).arrayBuffer()));
    expect(t).toContain("surveiller");
    expect(t).not.toContain("CROQUIS");
  });
});

describe("Paramètres › Fiche de contrôle (catégories)", () => {
  it("ajoute une catégorie et ses points, change son type, la déplace, la désactive puis la supprime ; réservé à l'administrateur", async () => {
    courant = admin();
    const r = await categoriePost(req("/api/categories-controle", "POST", { libelle: "Carrosserie", typeStatuts: "OK_ABIME" }), ctx());
    expect(r.status).toBe(200);
    const { id } = (await r.json()).data;
    const p1 = (await (await pointPost(req("/api/points-controle", "POST", { libelle: "Pare-chocs AV", categorieId: id }), ctx())).json()).data.id;
    await pointPost(req("/api/points-controle", "POST", { libelle: "Pare-chocs AR", categorieId: id }), ctx());
    await pointPatch(req(`/api/points-controle/${p1}`, "PATCH", { deplacer: "bas" }), ctx({ id: p1 }));
    expect((await db.pointControle.findMany({ where: { categorieId: id }, orderBy: { position: "asc" } })).map((p) => p.libelle)).toEqual(["Pare-chocs AR", "Pare-chocs AV"]);

    await categoriePatch(req(`/api/categories-controle/${id}`, "PATCH", { typeStatuts: "OK_A_REPARER", deplacer: "haut" }), ctx({ id }));
    const cats = await db.categorieControle.findMany({ orderBy: { position: "asc" } });
    expect(cats.at(-2)).toMatchObject({ id, typeStatuts: "OK_A_REPARER" });

    // Une catégorie désactivée n'est pas copiée dans les nouvelles fiches.
    await categoriePatch(req(`/api/categories-controle/${id}`, "PATCH", { isActive: false }), ctx({ id }));
    expect((await obtenirFiche(await ordre())).points.some((p) => p.categorie === "Carrosserie")).toBe(false);

    expect((await categorieDelete(req(`/api/categories-controle/${id}`, "DELETE"), ctx({ id }))).status).toBe(200);
    expect(await db.pointControle.count({ where: { categorieId: id } })).toBe(0);

    courant = sec();
    expect((await categoriePost(req("/api/categories-controle", "POST", { libelle: "Interdit", typeStatuts: "CASE" }), ctx())).status).toBe(403);
  });
});
