import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { POST as importRoute } from "@/app/api/stock/import/route";
import { GET as exportRoute } from "@/app/api/stock/export/route";
import { POST as campagneCreer } from "@/app/api/campagnes/route";
import { PATCH as campagneModifier, DELETE as campagneSupprimer } from "@/app/api/campagnes/[id]/route";
import { POST as campagneEnvoyer } from "@/app/api/campagnes/[id]/envoyer/route";
import { POST as desinscrire } from "@/app/api/public/desinscription/route";
import { db } from "@/lib/db";
import { signerDesinscription } from "@/lib/desinscription";
import { analyserLignes, analyserCsv } from "@/lib/import-pieces";
import { importerPieces } from "@/lib/services/import-pieces";
import { compterDestinataires, envoyerCampagne } from "@/lib/services/campagnes";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { creerFactureDepuisDevis } from "@/lib/services/factures";
import { creneau, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const admin = (): CurrentUser => ({ id: "adm", role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" });
const magasin = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const atelier = (): CurrentUser => ({ id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" });
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const csv = (...lignes: string[]) => analyserCsv(lignes.join("\n"));
const ENTETE = "Référence;Désignation;Prix achat HT;Prix vente HT;Stock;Seuil d'alerte";

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = magasin();
  vi.stubEnv("NEXTAUTH_SECRET", "secret-de-test-secret-de-test-123456");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("import de pièces", () => {
  it("l'aperçu n'écrit rien ; l'import crée, met à jour et AJOUTE le stock", async () => {
    const rows = csv(ENTETE, "p1;;;60;4;", "NEUVE;Pièce neuve;10;25,5;3;2");
    const apercu = await importerPieces({ id: "a", role: "ADMIN" }, rows, false);
    expect(apercu).toMatchObject({ appliquee: false, crees: 1, misAJour: 1, erreurs: 0 });
    expect(await db.piece.count()).toBe(2);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(5);

    const r = await importerPieces({ id: "a", role: "ADMIN" }, rows, true);
    expect(r).toMatchObject({ appliquee: true, crees: 1, misAJour: 1 });
    const p1 = await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } });
    expect(p1.stock).toBe(9); // 5 + 4
    expect(Number(p1.prixVenteHT)).toBe(60);
    expect(p1.nom).toBe("Plaquettes"); // cellule vide : inchangé
    const neuve = await db.piece.findUniqueOrThrow({ where: { reference: "NEUVE" } });
    expect(neuve).toMatchObject({ stock: 3, seuilAlerte: 2, nom: "Pièce neuve" });
    expect(Number(neuve.prixAchatHT)).toBe(10);
  });

  it("importe les lignes valides et liste les erreurs (nouvelle pièce incomplète, prix invalide, doublon)", async () => {
    const r = await importerPieces({ id: "a", role: "ADMIN" }, csv(ENTETE, "OK1;Pièce ok;;10;1;", "KO1;;;10;1;", "KO2;Prix;;abc;1;", "OK1;Doublon;;10;1;"), true);
    expect(r).toMatchObject({ crees: 1, misAJour: 0, erreurs: 3 });
    expect(r.lignes.filter((l) => l.action === "erreur").map((l) => l.ligne)).toEqual([3, 4, 5]);
    expect(r.lignes[1].messages[0]).toMatch(/désignation/);
    expect(await db.piece.findUnique({ where: { reference: "OK1" } })).not.toBeNull();
    expect(await db.piece.findUnique({ where: { reference: "KO1" } })).toBeNull();
  });

  it("ignore le prix d'achat pour un rôle qui ne le voit pas, et réactive une pièce désactivée", async () => {
    await db.piece.update({ where: { id: b.p2.id }, data: { isActive: false } });
    const r = await importerPieces({ id: "x", role: "MECANICIEN" }, csv(ENTETE, "p2;;99;11;;"), true);
    expect(r.avertissements[0]).toMatch(/Prix achat/);
    const p2 = await db.piece.findUniqueOrThrow({ where: { id: b.p2.id } });
    expect(Number(p2.prixAchatHT)).toBe(4);
    expect(Number(p2.prixVenteHT)).toBe(11);
    expect(p2.isActive).toBe(true);
  });

  it("déclenche le bon de commande automatique quand une pièce arrive au seuil", async () => {
    await importerPieces({ id: "a", role: "ADMIN" }, csv(ENTETE, "BAS;Pièce basse;1;5;1;3"), true);
    const bc = await db.bonCommande.findFirstOrThrow({ include: { lignes: true } });
    expect(bc).toMatchObject({ automatique: true, statut: "EN_ATTENTE" });
    expect(bc.lignes[0].quantite).toBe(5); // 2 × 3 − 1
  });

  it("signale un fichier sans colonne Référence", () => {
    expect(analyserLignes(csv("Nom;Prix", "x;1")).erreurFichier).toMatch(/Référence/);
  });
});

describe("routes d'import et d'export", () => {
  const requete = (contenu: string, nom: string, mode: string) => {
    const fd = new FormData();
    fd.append("fichier", new File([contenu], nom, { type: "text/csv" }));
    fd.append("mode", mode);
    return new NextRequest("http://localhost/api/stock/import", { method: "POST", body: fd, headers: { host: "localhost" } });
  };

  it("import via l'API : aperçu puis import, fichiers invalides refusés, Atelier interdit", async () => {
    const csvOk = `${ENTETE}\nAPI1;Pièce API;2;5;1;0`;
    const apercu = await (await importRoute(requete(csvOk, "p.csv", "apercu"), ctx())).json();
    expect(apercu.data).toMatchObject({ crees: 1, appliquee: false });
    expect(await db.piece.count({ where: { reference: "API1" } })).toBe(0);
    expect((await importRoute(requete(csvOk, "p.csv", "importer"), ctx())).status).toBe(200);
    expect(await db.piece.count({ where: { reference: "API1" } })).toBe(1);

    expect((await importRoute(requete("x", "p.pdf", "apercu"), ctx())).status).toBe(400);
    expect((await importRoute(requete(csvOk, "p.csv", "supprimer"), ctx())).status).toBe(400);
    courant = atelier();
    expect((await importRoute(requete(csvOk, "p.csv", "apercu"), ctx())).status).toBe(403);
  });

  it("export CSV / Excel : filtres respectés, prix d'achat selon le rôle, Atelier interdit", async () => {
    const get = (url: string) => exportRoute(new NextRequest(`http://localhost${url}`, { headers: { host: "localhost" } }), ctx());
    const reponse = await get("/api/stock/export?format=csv");
    const octets = new Uint8Array(await reponse.arrayBuffer());
    expect([...octets.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 : accents corrects dans Excel
    const csvAdmin = new TextDecoder().decode(octets);
    expect(csvAdmin).toContain("Référence;Désignation");
    expect(csvAdmin).toContain("Prix achat HT");
    expect(csvAdmin).toContain("P1;Plaquettes");
    expect((await (await get("/api/stock/export?format=csv&q=filtre")).text())).not.toContain("P1;");

    const xlsx = await get("/api/stock/export?format=xlsx");
    expect(xlsx.headers.get("content-type")).toContain("spreadsheetml");
    expect(Buffer.from(await xlsx.arrayBuffer()).subarray(0, 2).toString()).toBe("PK");

    const modele = await (await get("/api/stock/export?format=csv&modele=1")).text();
    expect(modele).toContain("BSH-0986494");
    courant = atelier();
    expect((await get("/api/stock/export?format=csv")).status).toBe(403);
  });
});

describe("campagnes", () => {
  beforeEach(async () => {
    await db.client.update({ where: { id: b.client.id }, data: { marketingOptIn: true } });
    await db.client.createMany({
      data: [
        { type: "PRO", companyName: "Pro Opt", lastName: "Pro", email: "pro@x.fr", marketingOptIn: true },
        { type: "PARTICULIER", lastName: "SansAccord", email: "non@x.fr", marketingOptIn: false },
        { type: "PARTICULIER", lastName: "SansEmail", marketingOptIn: true },
        { type: "PARTICULIER", lastName: "Anonyme", email: "anon@x.fr", marketingOptIn: true, anonymiseLe: new Date() },
      ],
    });
  });

  const corps = { nom: "Promo", audience: "TOUS", sujet: "Offre pneus", contenu: "Bonjour {prenom}, profitez de -15 % sur les pneus." };

  it("ne cible que les clients actifs avec e-mail et accord marketing", async () => {
    expect(await compterDestinataires()).toEqual({ TOUS: 2, PARTICULIER: 1, PRO: 1 });
  });

  it("Admin et Magasin gèrent les campagnes, l'Atelier non", async () => {
    const post = (u: CurrentUser) => {
      courant = u;
      return campagneCreer(new NextRequest("http://localhost/api/campagnes", { method: "POST", body: JSON.stringify(corps), headers: { host: "localhost", "content-type": "application/json" } }), ctx());
    };
    expect((await post(magasin())).status).toBe(200);
    expect((await post(admin())).status).toBe(200);
    expect((await post(atelier())).status).toBe(403);
    const c = await db.campagne.findFirstOrThrow();
    const json = (body: unknown, method: string) => new NextRequest("http://localhost/x", { method, body: JSON.stringify(body), headers: { host: "localhost", "content-type": "application/json" } });
    courant = magasin();
    expect((await campagneModifier(json({ ...corps, nom: "Promo 2" }, "PATCH"), ctx({ id: c.id }))).status).toBe(200);
    expect((await campagneSupprimer(json(undefined, "DELETE"), ctx({ id: c.id }))).status).toBe(200);
    courant = atelier();
    expect((await campagneEnvoyer(json(undefined, "POST"), ctx({ id: c.id }))).status).toBe(403);
  });

  it("refuse d'envoyer sans clé Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const c = await db.campagne.create({ data: { nom: "P", type: "MANUELLE", template: "campagne", canal: "EMAIL", sujet: "S", contenu: "Contenu du message promo." } });
    await expect(envoyerCampagne(c.id)).rejects.toMatchObject({ code: "EMAIL_NON_CONFIGURE" });
    expect((await db.campagne.findUniqueOrThrow({ where: { id: c.id } })).envoyeeLe).toBeNull();
  });

  it("envoie à chaque destinataire une seule fois, avec lien de désinscription et trace dans l'historique", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const c = await db.campagne.create({ data: { nom: "P", type: "MANUELLE", template: "campagne", canal: "EMAIL", audience: "TOUS", sujet: "Offre", contenu: "Bonjour {prenom} {nom}, -15 % sur les pneus." } });

    const r = await envoyerCampagne(c.id);
    expect(r).toMatchObject({ destinataires: 2, envoyes: 2, echecs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const envoi = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(envoi.htmlContent).toMatch(/desinscription\?c=[a-z0-9]+&amp;s=[0-9a-f]{32}/);
    expect(envoi.headers["List-Unsubscribe"]).toMatch(/^<http.*desinscription\?c=/);
    const logs = await db.messageLog.findMany({ where: { template: "campagne" } });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.statut === "ENVOYE" && l.clientId)).toBe(true);

    await expect(envoyerCampagne(c.id)).rejects.toMatchObject({ code: "DEJA_ENVOYEE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("une campagne partiellement échouée ne relance que les échecs", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle");
    let appels = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ({ ok: ++appels !== 1, status: 500, json: async () => ({}) })));
    const c = await db.campagne.create({ data: { nom: "P", type: "MANUELLE", template: "campagne", canal: "EMAIL", audience: "TOUS", sujet: "Offre", contenu: "Message de la campagne promo." } });
    expect(await envoyerCampagne(c.id)).toMatchObject({ envoyes: 1, echecs: 1 });
    const relance = await envoyerCampagne(c.id);
    expect(relance).toMatchObject({ envoyes: 2, echecs: 0 });
    expect(appels).toBe(3); // 2 premiers envois + 1 seul nouvel essai
  });

  it("le lien de désinscription retire le consentement (signature obligatoire)", async () => {
    const post = (c: string, s: string) => desinscrire(new NextRequest("http://localhost/api/public/desinscription", { method: "POST", body: JSON.stringify({ c, s }), headers: { host: "localhost", "content-type": "application/json" } }));
    courant = null; // route publique : aucune session
    expect((await post(b.client.id, "0".repeat(32))).status).toBe(400);
    expect((await db.client.findUniqueOrThrow({ where: { id: b.client.id } })).marketingOptIn).toBe(true);
    expect((await post(b.client.id, signerDesinscription(b.client.id))).status).toBe(200);
    expect((await db.client.findUniqueOrThrow({ where: { id: b.client.id } })).marketingOptIn).toBe(false);
    expect((await compterDestinataires()).TOUS).toBe(1);
  });
});

describe("réduction professionnelle sur les pièces", () => {
  it("garde le prix catalogue des pièces uniquement, jamais sur la main d'œuvre, et le reporte sur la facture", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { type: "PRO", companyName: "Garage Pro", discountRate: 10 } });
    const { id } = await creerDevis(b.user.id, {
      type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id,
      lignes: [
        { type: "PIECE", designation: "Plaquettes", quantite: 2, prixUnitaireHT: 45, prixCatalogueHT: 50, tvaRate: 20, pieceId: b.p1.id },
        { type: "MAIN_OEUVRE", designation: "MO", quantite: 1, prixUnitaireHT: 65, prixCatalogueHT: 65, tvaRate: 20 },
      ],
    });
    const lignes = await db.ligneDevis.findMany({ where: { devisId: id }, orderBy: { position: "asc" } });
    expect(Number(lignes[0].prixCatalogueHT)).toBe(50);
    expect(lignes[1].prixCatalogueHT).toBeNull(); // pas de réduction sur la main d'œuvre
    const devis = await db.devis.findUniqueOrThrow({ where: { id } });
    expect(Number(devis.remisePro)).toBe(10);
    expect(Number(devis.totalHT)).toBe(155); // 2 × 45 + 65

    await validerDevis(id, creneau(b.meca.id));
    const f = await creerFactureDepuisDevis(id, b.user.id);
    const facture = await db.facture.findUniqueOrThrow({ where: { id: f.id }, include: { lignes: { orderBy: { position: "asc" } } } });
    expect(Number(facture.remisePro)).toBe(10);
    expect(Number(facture.lignes[0].prixCatalogueHT)).toBe(50);
    expect(facture.lignes[1].prixCatalogueHT).toBeNull();
  });

  it("n'enregistre pas de prix catalogue s'il n'y a pas de réduction", async () => {
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [{ type: "PIECE", designation: "P", quantite: 1, prixUnitaireHT: 50, prixCatalogueHT: 50, tvaRate: 20, pieceId: b.p1.id }] });
    expect((await db.ligneDevis.findFirstOrThrow({ where: { devisId: id } })).prixCatalogueHT).toBeNull();
  });
});
