import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

// L'utilisateur courant est piloté par le test : on exerce les vraies routes (permissions, zod, services).
let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { POST as creerClient } from "@/app/api/clients/route";
import { GET as listerStock, POST as creerPiece } from "@/app/api/stock/route";
import { POST as creerDevisRoute } from "@/app/api/devis/route";
import { POST as validerRoute } from "@/app/api/devis/[id]/valider/route";
import { POST as paiementRoute } from "@/app/api/factures/[id]/paiements/route";
import { POST as factureRoute } from "@/app/api/factures/route";
import { GET as pdfDevis } from "@/app/api/devis/[id]/pdf/route";
import { GET as pdfFacture } from "@/app/api/factures/[id]/pdf/route";
import { GET as exportRoute } from "@/app/api/analyse/export/route";
import { POST as collabRoute } from "@/app/api/collaborateurs/route";
import { PATCH as collabPatch } from "@/app/api/collaborateurs/[id]/route";
import { DELETE as anonymiser } from "@/app/api/clients/[id]/anonymiser/route";
import { POST as rdvRoute, GET as rdvList } from "@/app/api/rendez-vous/route";
import { GET as impayes } from "@/app/api/cron/impayes/route";
import { GET as rappels } from "@/app/api/cron/rappels-rdv/route";
import { GET as retention } from "@/app/api/cron/retention/route";
import { GET as vinRoute } from "@/app/api/integrations/vin/route";
import { GET as paRoute } from "@/app/api/integrations/facture-electronique/route";
import { GET as tarifsGet, POST as tarifsPost } from "@/app/api/tarifs/route";
import { DELETE as tarifDelete } from "@/app/api/tarifs/[id]/route";
import { GET as vehiculesGet, POST as vehiculesPost } from "@/app/api/vehicules/route";
import { PATCH as vehiculePatch } from "@/app/api/vehicules/[id]/route";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const admin = (): CurrentUser => ({ id: "adm", role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" });
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const meca = (): CurrentUser => ({ id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" });

const req = (url: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { host: "localhost", ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
const ctx = (params: Record<string, string | string[]> = {}) => ({ params: Promise.resolve(params) });

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = sec();
});

describe("enveloppe des routes API", () => {
  it("401 sans session, 403 sans permission, 400 si la validation échoue", async () => {
    courant = null;
    expect((await creerClient(req("/api/clients", "POST", {}), ctx())).status).toBe(401);
    courant = meca();
    expect((await creerClient(req("/api/clients", "POST", { type: "PARTICULIER" }), ctx())).status).toBe(403);
    courant = sec();
    const r = await creerClient(req("/api/clients", "POST", { type: "PARTICULIER", paymentTerms: 30, creditLimit: 0, discountRate: 0, marketingOptIn: false }), ctx());
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("VALIDATION");
  });

  it("refuse un JSON invalide, une origine étrangère et un corps trop gros", async () => {
    const bad = new NextRequest("http://localhost/api/clients", { method: "POST", headers: { host: "localhost", "content-type": "application/json" }, body: "{pas du json" });
    expect((await creerClient(bad, ctx())).status).toBe(400);
    const cross = req("/api/clients", "POST", { type: "PARTICULIER" }, { origin: "https://evil.example" });
    const r = await creerClient(cross, ctx());
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("CSRF");
    const gros = req("/api/clients", "POST", { type: "PARTICULIER" }, { "content-length": "5000000" });
    expect((await creerClient(gros, ctx())).status).toBe(413);
  });

  it("crée un client valide", async () => {
    const ok = await creerClient(req("/api/clients", "POST", { type: "PARTICULIER", lastName: "Nouveau", email: "n@n.fr", paymentTerms: 30, creditLimit: 0, discountRate: 0, marketingOptIn: false }), ctx());
    expect(ok.status).toBe(200);
    await expect(db.client.count()).resolves.toBe(2);
  });
});

describe("confidentialité côté API", () => {
  it("le stock expose le prix d'achat à l'admin et au Magasin, la marge à l'admin seul, rien à l'Atelier", async () => {
    courant = sec();
    const magasin = JSON.stringify(await (await listerStock(req("/api/stock"), ctx())).json());
    expect(magasin).toMatch(/prixAchatHT/);
    expect(magasin).not.toMatch(/margePct/);
    courant = admin();
    expect(JSON.stringify(await (await listerStock(req("/api/stock"), ctx())).json())).toMatch(/prixAchatHT.*margePct|margePct.*prixAchatHT/);
    courant = meca();
    expect((await listerStock(req("/api/stock"), ctx())).status).toBe(403);
  });

  it("le Magasin et l'admin peuvent renseigner un prix d'achat", async () => {
    const corps = { reference: "NEW1", nom: "Nouvelle", prixAchatHT: 99, prixVenteHT: 120, stock: 1, seuilAlerte: 0, referencesCroisees: [] };
    await creerPiece(req("/api/stock", "POST", corps), ctx());
    expect(Number((await db.piece.findUniqueOrThrow({ where: { reference: "NEW1" } })).prixAchatHT)).toBe(99);
    courant = admin();
    await creerPiece(req("/api/stock", "POST", { ...corps, reference: "NEW2" }), ctx());
    expect(Number((await db.piece.findUniqueOrThrow({ where: { reference: "NEW2" } })).prixAchatHT)).toBe(99);
  });

  it("export CSV, collaborateurs et anonymisation sont réservés à l'admin", async () => {
    expect((await exportRoute(req("/api/analyse/export?type=factures"), ctx())).status).toBe(403);
    expect((await collabRoute(req("/api/collaborateurs", "POST", {}), ctx())).status).toBe(403);
    expect((await anonymiser(req(`/api/clients/${b.client.id}/anonymiser`, "DELETE"), ctx({ id: b.client.id }))).status).toBe(403);
    courant = admin();
    const csv = await exportRoute(req("/api/analyse/export?type=factures"), ctx());
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect((await anonymiser(req(`/api/clients/${b.client.id}/anonymiser`, "DELETE"), ctx({ id: b.client.id }))).status).toBe(200);
    expect(await db.client.findUniqueOrThrow({ where: { id: b.client.id } })).toMatchObject({ email: null, anonymiseLe: expect.any(Date) });
  });
});

describe("parcours devis → facture par l'API", () => {
  it("valide malgré un stock insuffisant (alerte), facture, paie et génère les PDF", async () => {
    const creer = await creerDevisRoute(req("/api/devis", "POST", { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 2, 50)] }), ctx());
    const { id } = (await creer.json()).data;
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("BROUILLON"); // « Envoyé » seulement après un envoi d'e-mail réussi

    await db.piece.update({ where: { id: b.p1.id }, data: { stock: 1 } });
    const ok = await validerRoute(req(`/api/devis/${id}/valider`, "POST", creneau(b.meca.id)), ctx({ id }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.penuries[0]).toMatchObject({ demande: 2, disponible: 1 });
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(-1);
    const fac = await factureRoute(req("/api/factures", "POST", { devisId: id }), ctx());
    const factureId = (await fac.json()).data.id;
    const total = Number((await db.facture.findUniqueOrThrow({ where: { id: factureId } })).totalTTC);
    expect((await paiementRoute(req(`/api/factures/${factureId}/paiements`, "POST", { montant: total + 1, mode: "CB" }), ctx({ id: factureId }))).status).toBe(400);
    expect((await paiementRoute(req(`/api/factures/${factureId}/paiements`, "POST", { montant: total, mode: "CB" }), ctx({ id: factureId }))).status).toBe(200);
    expect((await db.facture.findUniqueOrThrow({ where: { id: factureId } })).statut).toBe("PAYEE");

    for (const [h, p] of [[pdfDevis, `/api/devis/${id}/pdf`], [pdfFacture, `/api/factures/${factureId}/pdf`]] as const) {
      const res = await h(req(p), ctx({ id: p.includes("factures") ? factureId : id }));
      expect(res.headers.get("content-type")).toBe("application/pdf");
      expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
    }
    const pa = await paRoute(req(`/api/integrations/facture-electronique?factureId=${factureId}`), ctx());
    expect((await pa.json()).data.statut).toContain("simulation");
  });

  it("le mécanicien ne peut ni créer de devis ni lire les PDF", async () => {
    courant = meca();
    expect((await creerDevisRoute(req("/api/devis", "POST", {}), ctx())).status).toBe(403);
    expect((await pdfDevis(req("/api/devis/x/pdf"), ctx({ id: "x" }))).status).toBe(403);
  });
});

describe("collaborateurs et rendez-vous", () => {
  it("empêche de retirer le dernier administrateur et crée un compte au mot de passe fort", async () => {
    courant = admin();
    const unique = await db.user.create({ data: { email: "root@test.fr", passwordHash: "x", firstName: "R", lastName: "T", role: "ADMIN" } });
    const patch = (body: object) => collabPatch(req(`/api/collaborateurs/${unique.id}`, "PATCH", body), ctx({ id: unique.id }));
    const r = await patch({ firstName: "R", lastName: "T", role: "SECRETARIAT", isActive: true });
    expect((await r.json()).error.code).toBe("DERNIER_ADMIN");
    expect((await collabRoute(req("/api/collaborateurs", "POST", { email: "n@t.fr", firstName: "N", lastName: "T", role: "MECANICIEN", password: "court" }), ctx())).status).toBe(400);
    const ok = await collabRoute(req("/api/collaborateurs", "POST", { email: "N@T.fr", firstName: "N", lastName: "T", role: "MECANICIEN", password: "un-mot-de-passe-solide" }), ctx());
    expect(ok.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { email: "n@t.fr" } })).passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it("crée un rendez-vous, refuse le conflit (409) et liste la semaine", async () => {
    const corps = { clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id, debut: "2026-11-12T09:00", fin: "2026-11-12T10:00" };
    expect((await rdvRoute(req("/api/rendez-vous", "POST", corps), ctx())).status).toBe(200);
    const conflit = await rdvRoute(req("/api/rendez-vous", "POST", { ...corps, debut: "2026-11-12T09:30", fin: "2026-11-12T10:30" }), ctx());
    expect(conflit.status).toBe(409);
    const liste = await (await rdvList(req("/api/rendez-vous?du=2026-11-09&au=2026-11-15"), ctx())).json();
    expect(liste.data).toHaveLength(1);
    expect(liste.data[0].couleur).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("tâches planifiées et intégrations", () => {
  it("exigent le secret CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "secret-de-test-assez-long");
    for (const h of [impayes, rappels, retention]) {
      expect((await h(req("/api/cron/x"))).status).toBe(401);
      expect((await h(req("/api/cron/x", "GET", undefined, { authorization: "Bearer mauvais-secret-de-test-xx" }))).status).toBe(401);
      expect((await h(req("/api/cron/x", "GET", undefined, { authorization: "Bearer secret-de-test-assez-long" }))).status).toBe(200);
    }
    vi.stubEnv("CRON_SECRET", "");
    expect((await impayes(req("/api/cron/impayes", "GET", undefined, { authorization: "Bearer " }))).status).toBe(503);
    vi.unstubAllEnvs();
  });

  it("le décodage VIN rend null sans configuration (saisie manuelle) et valide le format", async () => {
    const ok = await vinRoute(req("/api/integrations/vin?vin=VF3LCBHZ6JS123456"), ctx());
    expect((await ok.json()).data).toBeNull();
    expect((await vinRoute(req("/api/integrations/vin?vin=ABC"), ctx())).status).toBe(400);
  });
});

describe("couleur d'un collaborateur", () => {
  it("se règle à la création et à la modification, en #RRGGBB uniquement", async () => {
    courant = admin();
    const corps = { email: "c@t.fr", firstName: "C", lastName: "T", role: "MECANICIEN", password: "un-mot-de-passe-solide" };
    expect((await collabRoute(req("/api/collaborateurs", "POST", { ...corps, couleur: "rouge" }), ctx())).status).toBe(400);
    const ok = await collabRoute(req("/api/collaborateurs", "POST", { ...corps, couleur: "#FF8800" }), ctx());
    const { id } = (await ok.json()).data;
    expect((await db.user.findUniqueOrThrow({ where: { id } })).couleur).toBe("#ff8800");
    const patch = (couleur: string) => collabPatch(req(`/api/collaborateurs/${id}`, "PATCH", { firstName: "C", lastName: "T", role: "MECANICIEN", isActive: true, couleur }), ctx({ id }));
    expect((await patch("#00aa55")).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id } })).couleur).toBe("#00aa55");
    expect((await patch("")).status).toBe(200); // retour à la couleur automatique
    expect((await db.user.findUniqueOrThrow({ where: { id } })).couleur).toBeNull();
  });

  it("le planning renvoie la couleur attribuée au collaborateur", async () => {
    await db.user.update({ where: { id: b.meca.id }, data: { couleur: "#ff00aa" } });
    await rdvRoute(req("/api/rendez-vous", "POST", { clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id, debut: "2026-11-12T09:00", fin: "2026-11-12T10:00" }), ctx());
    const liste = (await (await rdvList(req("/api/rendez-vous?du=2026-11-09&au=2026-11-15"), ctx())).json()).data;
    expect(liste[0].couleur).toBe("#ff00aa");
  });
});

describe("tarifs et véhicules", () => {
  it("les tarifs sont lisibles par le secrétariat mais modifiables par l'admin seulement", async () => {
    const corps = { type: "FORFAIT", libelle: "Forfait test", montantHT: 39, actif: true };
    expect((await tarifsPost(req("/api/tarifs", "POST", corps), ctx())).status).toBe(403);
    courant = admin();
    const { id } = (await (await tarifsPost(req("/api/tarifs", "POST", corps), ctx())).json()).data;
    courant = sec();
    expect((await (await tarifsGet(req("/api/tarifs"), ctx())).json()).data).toHaveLength(1);
    expect((await tarifDelete(req(`/api/tarifs/${id}`, "DELETE"), ctx({ id }))).status).toBe(403);
    courant = admin();
    expect((await tarifDelete(req(`/api/tarifs/${id}`, "DELETE"), ctx({ id }))).status).toBe(200);
    expect(await db.tarif.count({ where: { actif: true } })).toBe(0);
  });

  it("crée, modifie et recherche un véhicule ; une plaque en doublon est refusée (409)", async () => {
    const corps = { clientId: b.client.id, vin: "", immatriculation: "zz-999-yy", marque: "Renault", modele: "Clio", annee: 2020, motorisation: "" };
    const ok = await vehiculesPost(req("/api/vehicules", "POST", corps), ctx());
    const id = (await ok.json()).data.id;
    expect((await db.vehicule.findUniqueOrThrow({ where: { id } })).immatriculation).toBe("ZZ-999-YY");
    expect((await vehiculesPost(req("/api/vehicules", "POST", corps), ctx())).status).toBe(409);
    expect((await vehiculePatch(req(`/api/vehicules/${id}`, "PATCH", { ...corps, modele: "Captur" }), ctx({ id }))).status).toBe(200);
    const liste = (await (await vehiculesGet(req("/api/vehicules?q=captur"), ctx())).json()).data;
    expect(liste).toHaveLength(1);
    expect((await vehiculesPost(req("/api/vehicules", "POST", { ...corps, vin: "BADVIN" }), ctx())).status).toBe(400);
    courant = meca();
    expect((await vehiculesGet(req("/api/vehicules"), ctx())).status).toBe(403);
  });
});
