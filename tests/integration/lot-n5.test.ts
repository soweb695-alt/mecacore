import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { GET as devisSearch } from "@/app/api/devis/route";
import { GET as stockGet } from "@/app/api/stock/route";
import { POST as factureManuelle } from "@/app/api/factures/manuelle/route";
import { POST as factureDevis } from "@/app/api/factures/route";
import { PATCH as facturePatch } from "@/app/api/factures/[id]/route";
import { GET as facturePdf } from "@/app/api/factures/[id]/pdf/route";
import { POST as annulerRoute } from "@/app/api/factures/[id]/annuler/route";
import { PATCH as banquePatch } from "@/app/api/parametres/banque/route";
import { POST as pointPost } from "@/app/api/points-controle/route";
import { PATCH as pointPatch, DELETE as pointDelete } from "@/app/api/points-controle/[id]/route";
import { GET as rdvList } from "@/app/api/rendez-vous/route";
import { PUT as fichePut } from "@/app/api/ordres-reparation/[id]/fiche/route";
import { POST as ficheRenvoyer } from "@/app/api/ordres-reparation/[id]/fiche/renvoyer/route";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { obtenirFiche } from "@/lib/services/fiche-controle";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
let adminId = "";
const admin = (): CurrentUser => ({ id: adminId, role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" });
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const meca = (): CurrentUser => ({ id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" });
const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { host: "localhost", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const data = async (r: Response) => (await r.json()).data;
const MO = { type: "MAIN_OEUVRE" as const, designation: "Main d'œuvre", quantite: 1, prixUnitaireHT: 50, tvaRate: 20 };

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  adminId = (await db.user.create({ data: { email: "adm@test.fr", passwordHash: "x", firstName: "Adm", lastName: "Test", role: "ADMIN" } })).id;
  courant = sec();
  // Le modèle de fiche de contrôle est vidé avec le reste : on recrée huit points.
  await db.pointControle.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ libelle: `Point ${i + 1}`, position: i })) });
});

describe("recherches", () => {
  it("retrouve un devis par le prénom (et « prénom nom ») du client", async () => {
    await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    for (const q of ["Jean", "jean durand", "Durand Jean"]) {
      const r = await data(await devisSearch(req(`/api/devis?q=${encodeURIComponent(q)}`), ctx()));
      expect(r, q).toHaveLength(1);
    }
    expect(await data(await devisSearch(req("/api/devis?q=Zoe"), ctx()))).toHaveLength(0);
  });

  it("remonte la pièce en stock via sa référence croisée, ponctuation ignorée, en stock d'abord", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { referencesCroisees: ["0 986-452 041"], stock: 0 } });
    await db.piece.update({ where: { id: b.p2.id }, data: { referencesCroisees: ["0986452041"], stock: 4 } });
    const r = await data(await stockGet(req("/api/stock?q=0986452041"), ctx()));
    expect(r.items.map((p: { reference: string }) => p.reference)).toEqual(["P2", "P1"]);
    expect(r.items[0]).toMatchObject({ reference: "P2", stock: 4, referenceCroisee: "0986452041" });
    // Une recherche par référence principale ne se déclare pas « équivalent ».
    const direct = await data(await stockGet(req("/api/stock?q=P2"), ctx()));
    expect(direct.items[0].referenceCroisee).toBeNull();
  });
});

describe("facture manuelle", () => {
  it("crée la facture, décrémente le stock, trace la remise globale et le mode de règlement", async () => {
    const r = await factureManuelle(
      req("/api/factures/manuelle", "POST", {
        clientId: b.client.id,
        lignes: [ligne(b.p1.id, 2, 50), MO],
        remise: { type: "POURCENT", base: "HT", valeur: 10 },
        modePaiement: "VIREMENT",
      }),
      ctx(),
    );
    expect(r.status).toBe(200);
    const { id, numero } = await data(r);
    expect(numero).toMatch(/^FAC-\d{4}-0001$/);
    const f = await db.facture.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
    expect(f).toMatchObject({ manuelle: true, devisId: null, modePaiement: "VIREMENT", remiseGlobaleType: "POURCENT", remiseGlobaleBase: "HT" });
    expect(Number(f.totalHTAvantRemise)).toBe(150);
    expect(Number(f.remiseGlobaleMontant)).toBe(15);
    expect([Number(f.totalHT), Number(f.totalTVA), Number(f.totalTTC)]).toEqual([135, 27, 162]);
    expect(f.lignes).toHaveLength(2);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(3);
  });

  it("refuse si le stock est insuffisant : aucune facture, stock intact", async () => {
    const r = await factureManuelle(req("/api/factures/manuelle", "POST", { clientId: b.client.id, lignes: [ligne(b.p1.id, 9, 50)] }), ctx());
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("STOCK_INSUFFISANT");
    expect(await db.facture.count()).toBe(0);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(5);
  });

  it("refuse une remise supérieure au total, et accepte les lignes sans pièce", async () => {
    const trop = await factureManuelle(req("/api/factures/manuelle", "POST", { clientId: b.client.id, lignes: [MO], remise: { type: "EUROS", base: "HT", valeur: 50 } }), ctx());
    expect(trop.status).toBe(400);
    const ok = await factureManuelle(req("/api/factures/manuelle", "POST", { clientId: b.client.id, lignes: [MO], remise: { type: "EUROS", base: "TTC", valeur: 12 } }), ctx());
    expect(ok.status).toBe(200);
    const f = await db.facture.findFirstOrThrow();
    expect(Number(f.totalTTC)).toBe(48);
  });

  it("l'annulation d'une facture manuelle restitue le stock (une seule fois)", async () => {
    const { id } = await data(await factureManuelle(req("/api/factures/manuelle", "POST", { clientId: b.client.id, lignes: [ligne(b.p1.id, 2, 50)] }), ctx()));
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(3);
    courant = admin();
    expect((await annulerRoute(req(`/api/factures/${id}/annuler`, "POST"), ctx({ id }))).status).toBe(200);
    expect((await annulerRoute(req(`/api/factures/${id}/annuler`, "POST"), ctx({ id }))).status).toBe(200);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(5);
  });

  it("l'Atelier ne peut pas créer de facture", async () => {
    courant = meca();
    expect((await factureManuelle(req("/api/factures/manuelle", "POST", { clientId: b.client.id, lignes: [MO] }), ctx())).status).toBe(403);
  });

  it("remise globale sur une facture issue d'un devis", async () => {
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 2, 50)] });
    await validerDevis(id, {});
    const r = await factureDevis(req("/api/factures", "POST", { devisId: id, remise: { type: "EUROS", base: "HT", valeur: 20 }, modePaiement: "CHEQUE" }), ctx());
    expect(r.status).toBe(200);
    const f = await db.facture.findFirstOrThrow();
    expect([Number(f.totalHT), Number(f.totalTTC)]).toEqual([80, 96]);
    expect(f.modePaiement).toBe("CHEQUE");
  });
});

describe("virement : IBAN / BIC sur le PDF", () => {
  /** Texte affiché par le PDF : flux décompressés, chaînes hexadécimales décodées. */
  const texte = (buf: Buffer) => {
    const brut = buf.toString("latin1");
    let out = "";
    for (const m of brut.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try {
        const flux = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
        for (const h of flux.matchAll(/<([0-9A-Fa-f]+)>/g)) out += `${Buffer.from(h[1], "hex").toString("latin1")}\n`;
      } catch {
        /* flux non compressé ou binaire : ignoré */
      }
    }
    return out;
  };

  async function creer() {
    const { id } = await data(await factureManuelle(req("/api/factures/manuelle", "POST", { clientId: b.client.id, lignes: [MO], modePaiement: "VIREMENT" }), ctx()));
    return id as string;
  }
  const pdf = async (id: string) => Buffer.from(await (await facturePdf(req(`/api/factures/${id}/pdf`), ctx({ id }))).arrayBuffer());

  it("n'affiche rien sans coordonnées, puis l'IBAN et le BIC une fois saisis par l'administrateur", async () => {
    const id = await creer();
    expect(texte(await pdf(id))).not.toContain("IBAN");
    courant = sec();
    expect((await banquePatch(req("/api/parametres/banque", "PATCH", { iban: "FR14 2004 1010 0505 0001 3M02 606", bic: "PSSTFRPP" }), ctx())).status).toBe(403);
    courant = admin();
    expect((await banquePatch(req("/api/parametres/banque", "PATCH", { iban: "FR14 2004 1010 0505 0001 3M02 606", bic: "PSSTFRPP" }), ctx())).status).toBe(200);
    const avec = texte(await pdf(id));
    expect(avec).toContain("FR1420041010050500013M02606");
    expect(avec).toContain("PSSTFRPP");
  });

  it("l'affichage suit le mode de règlement choisi sur la facture", async () => {
    courant = admin();
    await banquePatch(req("/api/parametres/banque", "PATCH", { iban: "FR14 2004 1010 0505 0001 3M02 606", bic: "PSSTFRPP" }), ctx());
    const id = await creer();
    expect(texte(await pdf(id))).toContain("PSSTFRPP");
    courant = sec();
    expect((await facturePatch(req(`/api/factures/${id}`, "PATCH", { modePaiement: "CB" }), ctx({ id }))).status).toBe(200);
    expect(texte(await pdf(id))).not.toContain("PSSTFRPP");
    expect((await facturePatch(req(`/api/factures/${id}`, "PATCH", { modePaiement: "VIREMENT" }), ctx({ id }))).status).toBe(200);
    expect(texte(await pdf(id))).toContain("PSSTFRPP");
  });

  it("rejette un IBAN invalide", async () => {
    courant = admin();
    expect((await banquePatch(req("/api/parametres/banque", "PATCH", { iban: "FR00 1234", bic: "" }), ctx())).status).toBe(400);
  });
});

describe("planning de l'Atelier", () => {
  it("ne remonte que les rendez-vous du technicien, en lecture seule", async () => {
    const autre = await db.user.create({ data: { email: "m2@test.fr", passwordHash: "x", firstName: "Autre", lastName: "Meca", role: "MECANICIEN" } });
    const base = { clientId: b.client.id, vehiculeId: b.vehicule.id };
    await db.rendezVous.create({ data: { ...base, userId: b.meca.id, debut: new Date("2027-03-02T08:00:00Z"), fin: new Date("2027-03-02T09:00:00Z") } });
    await db.rendezVous.create({ data: { ...base, userId: autre.id, debut: new Date("2027-03-02T10:00:00Z"), fin: new Date("2027-03-02T11:00:00Z") } });
    const q = "/api/rendez-vous?du=2027-03-01&au=2027-03-07";
    courant = meca();
    const mien = await data(await rdvList(req(q), ctx()));
    expect(mien).toHaveLength(1);
    expect(mien[0].userId).toBe(b.meca.id);
    courant = sec();
    expect(await data(await rdvList(req(q), ctx()))).toHaveLength(2);
  });
});

describe("fiche de contrôle", () => {
  async function ordre() {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [MO] });
    await validerDevis(id, creneau(b.meca.id));
    return db.ordreReparation.findFirstOrThrow({ where: { devisId: id } });
  }
  const saisie = (points: { id: string; resultat: string }[], valider: boolean, remarques = "RAS") => ({ points, remarques, valider });

  it("copie les points actifs du modèle, sans suivre les modifications ultérieures du modèle", async () => {
    const o = await ordre();
    const f = await obtenirFiche(o.id);
    expect(f.points.length).toBeGreaterThanOrEqual(8);
    expect(f.points.every((p) => p.resultat === "NON_VERIFIE")).toBe(true);
    courant = admin();
    const nouveau = await data(await pointPost(req("/api/points-controle", "POST", { libelle: "Points ajoutés" }), ctx()));
    expect((await obtenirFiche(o.id)).points).toHaveLength(f.points.length);
    // Désactivation et suppression d'un point du modèle
    expect((await pointPatch(req(`/api/points-controle/${nouveau.id}`, "PATCH", { isActive: false }), ctx({ id: nouveau.id }))).status).toBe(200);
    expect((await pointDelete(req(`/api/points-controle/${nouveau.id}`, "DELETE"), ctx({ id: nouveau.id }))).status).toBe(200);
    courant = sec();
    expect((await pointPost(req("/api/points-controle", "POST", { libelle: "Interdit" }), ctx())).status).toBe(403);
  });

  it("le technicien remplit puis valide : la fiche passe au Magasin, qui peut la renvoyer", async () => {
    const o = await ordre();
    const f = await obtenirFiche(o.id);
    const tous = (resultat: string) => f.points.map((p) => ({ id: p.id, resultat }));
    courant = meca();

    // Validation impossible tant que tout n'est pas renseigné.
    const incomplet = await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", saisie(f.points.map((p, i) => ({ id: p.id, resultat: i === 0 ? "OK" : "NON_VERIFIE" })), true)), ctx({ id: o.id }));
    expect(incomplet.status).toBe(400);
    expect((await incomplet.json()).error.code).toBe("FICHE_INCOMPLETE");
    expect((await db.ficheControle.findUniqueOrThrow({ where: { ordreId: o.id } })).statut).toBe("EN_COURS");

    // Enregistrement en brouillon puis validation.
    expect((await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", saisie(tous("OK"), false, "Brouillon")), ctx({ id: o.id }))).status).toBe(200);
    const pts = tous("OK");
    pts[1].resultat = "A_SURVEILLER";
    expect((await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", saisie(pts, true, "Pneus à surveiller")), ctx({ id: o.id }))).status).toBe(200);
    const apres = await db.ficheControle.findUniqueOrThrow({ where: { ordreId: o.id }, include: { points: true } });
    expect(apres).toMatchObject({ statut: "TRANSMISE", remarques: "Pneus à surveiller", valideeParId: b.meca.id });
    expect(apres.points.filter((p) => p.resultat === "A_SURVEILLER")).toHaveLength(1);

    // Plus modifiable par l'atelier une fois transmise.
    const encore = await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", saisie(tous("DEFAUT"), true)), ctx({ id: o.id }));
    expect(encore.status).toBe(409);
    // L'atelier ne renvoie pas la fiche : c'est le Magasin qui la renvoie pour correction.
    expect((await ficheRenvoyer(req(`/api/ordres-reparation/${o.id}/fiche/renvoyer`, "POST"), ctx({ id: o.id }))).status).toBe(403);

    // Renvoi à l'atelier : la fiche redevient modifiable.
    courant = sec();
    expect(await db.ficheControle.count({ where: { statut: "TRANSMISE" } })).toBe(1);
    expect((await ficheRenvoyer(req(`/api/ordres-reparation/${o.id}/fiche/renvoyer`, "POST"), ctx({ id: o.id }))).status).toBe(200);
    expect((await ficheRenvoyer(req(`/api/ordres-reparation/${o.id}/fiche/renvoyer`, "POST"), ctx({ id: o.id }))).status).toBe(409);
    expect((await db.ficheControle.findUniqueOrThrow({ where: { ordreId: o.id } })).statut).toBe("EN_COURS");
  });

  it("un autre technicien ou le Magasin ne peuvent pas remplir la fiche", async () => {
    const o = await ordre();
    const f = await obtenirFiche(o.id);
    const corps = saisie(f.points.map((p) => ({ id: p.id, resultat: "OK" })), true);
    courant = sec();
    expect((await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", corps), ctx({ id: o.id }))).status).toBe(403);
    const autre = await db.user.create({ data: { email: "m3@test.fr", passwordHash: "x", firstName: "Autre", lastName: "Meca", role: "MECANICIEN" } });
    courant = { id: autre.id, role: "MECANICIEN", email: "m3@test.fr", firstName: "A", lastName: "M" };
    expect((await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", corps), ctx({ id: o.id }))).status).toBe(403);
    // Un point étranger à la fiche est refusé.
    courant = meca();
    const faux = await fichePut(req(`/api/ordres-reparation/${o.id}/fiche`, "PUT", saisie([{ id: "inconnu", resultat: "OK" }], false)), ctx({ id: o.id }));
    expect(faux.status).toBe(400);
  });
});
