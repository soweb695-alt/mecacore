import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { GET as cronImpayes } from "@/app/api/cron/impayes/route";
import { GET as cronRappels } from "@/app/api/cron/rappels-rdv/route";
import { POST as rappelsPost } from "@/app/api/rappels-rdv/route";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { annulerFacture, creerBrouillonTx, creerFactureDepuisDevis, creerFactureManuelle, emettreBrouillon, modifierBrouillon } from "@/lib/services/factures";
import { enregistrerRdv } from "@/lib/services/rdv";
import { pdfDevis } from "@/lib/pdf/devis";
import { pdfFacture } from "@/lib/pdf/facture";
import { ajouterJoursStr, jourParis } from "@/lib/time";
import { resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });
const meca = (): CurrentUser => ({ id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" });
const req = (url: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { host: "localhost", ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });

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

const VIDANGE = "Vidange moteur, remplacement du filtre à huile, contrôle des niveaux.";

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = sec();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("descriptif des lignes", () => {
  it("est enregistré sur le devis, recopié sur la facture et imprimé sur les deux PDF", async () => {
    const { id } = await creerDevis(b.user.id, {
      type: "MECANIQUE",
      clientId: b.client.id,
      vehiculeId: b.vehicule.id,
      lignes: [{ type: "FORFAIT", designation: "Forfait vidange", description: `${VIDANGE}\nHuile 5W30 fournie.`, quantite: 1, prixUnitaireHT: 89, tvaRate: 20 }],
    });
    expect((await db.ligneDevis.findFirstOrThrow({ where: { devisId: id } })).description).toBe(`${VIDANGE}\nHuile 5W30 fournie.`);
    expect(textePdf((await pdfDevis(id))!.pdf)).toContain("Huile 5W30 fournie.");

    await validerDevis(id, { mecanicienId: b.meca.id, rdv: { debut: "2027-04-02T09:00", fin: "2027-04-02T10:00" } });
    const f = await creerFactureDepuisDevis(id, b.user.id);
    expect((await db.ligneFacture.findFirstOrThrow({ where: { factureId: f.id } })).description).toBe(`${VIDANGE}\nHuile 5W30 fournie.`);
    expect(textePdf((await pdfFacture(f.id))!.pdf)).toContain("contr");
  });

  it("une facture saisie à la main garde son descriptif ; un descriptif vide n'est pas enregistré", async () => {
    const f = await creerFactureManuelle(b.user.id, {
      clientId: b.client.id,
      lignes: [
        { type: "FORFAIT", designation: "Forfait vidange", description: VIDANGE, quantite: 1, prixUnitaireHT: 89, tvaRate: 20 },
        { type: "FRAIS_DIVERS", designation: "Recyclage", description: "   ", quantite: 1, prixUnitaireHT: 5, tvaRate: 20 },
      ],
    });
    const lignes = await db.ligneFacture.findMany({ where: { factureId: f.id }, orderBy: { position: "asc" } });
    expect(lignes.map((l) => l.description)).toEqual([VIDANGE, null]);
    expect(textePdf((await pdfFacture(f.id))!.pdf)).toContain("Vidange moteur");
  });
});

describe("références du descriptif déduites du stock", () => {
  const stock = async (id: string) => (await db.piece.findUniqueOrThrow({ where: { id } })).stock;
  const forfait = (piecesDescriptif: { pieceId: string; quantite: number }[], quantite = 1) => ({
    type: "FORFAIT" as const,
    designation: "Forfait freinage",
    description: "Remplacement plaquettes P1",
    quantite,
    prixUnitaireHT: 120,
    tvaRate: 20,
    piecesDescriptif,
  });

  it("devis : enregistrées sur la ligne, déduites à la validation (× quantité de la ligne)", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [forfait([{ pieceId: b.p1.id, quantite: 2 }], 2)] });
    expect(await stock(b.p1.id)).toBe(5);
    const lu = await db.ligneDevis.findFirstOrThrow({ where: { devisId: id } });
    expect(lu.composition).toEqual([{ pieceId: b.p1.id, reference: "P1", nom: "Plaquettes", quantite: 2, descriptif: true }]);
    expect(textePdf((await pdfDevis(id))!.pdf)).toContain("P1");

    await validerDevis(id, { mecanicienId: b.meca.id, rdv: { debut: "2027-04-02T09:00", fin: "2027-04-02T10:00" } });
    expect(await stock(b.p1.id)).toBe(1);
  });

  it("refuse une pièce désactivée et une quantité de ligne non entière", async () => {
    await db.piece.update({ where: { id: b.p2.id }, data: { isActive: false } });
    await expect(creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [forfait([{ pieceId: b.p2.id, quantite: 1 }])] })).rejects.toMatchObject({ code: "PIECE_INTROUVABLE" });
    const { ligneSchema } = await import("@/lib/validators/devis");
    expect(ligneSchema.safeParse(forfait([{ pieceId: b.p1.id, quantite: 1 }], 1.5)).success).toBe(false);
  });

  it("facture saisie à la main : déduites à l'émission, rendues à l'annulation", async () => {
    const f = await creerFactureManuelle(b.user.id, { clientId: b.client.id, lignes: [forfait([{ pieceId: b.p1.id, quantite: 1 }, { pieceId: b.p2.id, quantite: 3 }])] });
    expect([await stock(b.p1.id), await stock(b.p2.id)]).toEqual([4, 2]);
    await annulerFacture(f.id);
    expect([await stock(b.p1.id), await stock(b.p2.id)]).toEqual([5, 5]);
  });

  it("brouillon de facture : une pièce rattachée après le devis est déduite à l'émission, en plus des pièces du devis", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [forfait([{ pieceId: b.p1.id, quantite: 1 }])] });
    const { ordre } = await validerDevis(id, { mecanicienId: b.meca.id, rdv: { debut: "2027-04-02T09:00", fin: "2027-04-02T10:00" } });
    expect(await stock(b.p1.id)).toBe(4);
    const br = await db.$transaction((tx) => creerBrouillonTx(tx, ordre!.id));
    const l = await db.ligneFacture.findFirstOrThrow({ where: { factureId: br.id } });
    await modifierBrouillon(br.id, { lignes: [{ ...forfait([{ pieceId: b.p1.id, quantite: 1 }, { pieceId: b.p2.id, quantite: 2 }]), id: l.id }] });
    expect(await stock(b.p2.id)).toBe(5);
    await emettreBrouillon(br.id, b.user.id);
    expect([await stock(b.p1.id), await stock(b.p2.id)]).toEqual([4, 3]);
  });
});

describe("aucun envoi automatique", () => {
  it("les tâches planifiées des rappels et du récapitulatif des impayés n'envoient plus rien", async () => {
    vi.stubEnv("CRON_SECRET", "secret-de-test-assez-long");
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubEnv("BREVO_SENDER_EMAIL", "garage@example.com");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await db.campagne.create({ data: { nom: "J-1", type: "AUTOMATIQUE", template: "rdv_rappel_j1", declencheur: "RDV_J1", joursAvant: 1, canal: "EMAIL" } });
    const demain = ajouterJoursStr(jourParis(), 1);
    await enregistrerRdv({ clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id, debut: `${demain}T14:00`, fin: `${demain}T15:00` });

    const auth = { authorization: "Bearer secret-de-test-assez-long" };
    expect((await (await cronRappels(req("/api/cron/rappels-rdv", "GET", undefined, auth))).json()).data.desactive).toBe(true);
    expect((await (await cronImpayes(req("/api/cron/impayes", "GET", undefined, auth))).json()).data.desactive).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await db.messageLog.count()).toBe(0);
  });

  it("les rappels du jour s'envoient depuis le tableau de bord, après validation (pas l'atelier)", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubEnv("BREVO_SENDER_EMAIL", "garage@example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const c = await db.campagne.create({ data: { nom: "J-1", type: "AUTOMATIQUE", template: "rdv_rappel_j1", declencheur: "RDV_J1", joursAvant: 1, canal: "EMAIL" } });
    const demain = ajouterJoursStr(jourParis(), 1);
    const rdv = await enregistrerRdv({ clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id, debut: `${demain}T14:00`, fin: `${demain}T15:00` });
    const corps = { rappels: [{ rdvId: rdv.id, campagneId: c.id }] };

    courant = meca();
    expect((await rappelsPost(req("/api/rappels-rdv", "POST", corps), { params: Promise.resolve({}) })).status).toBe(403);
    courant = sec();
    const r = await (await rappelsPost(req("/api/rappels-rdv", "POST", corps), { params: Promise.resolve({}) })).json();
    expect(r.data.resultats).toEqual([{ rdvId: rdv.id, campagneId: c.id, resultat: "envoye" }]);
    expect(await db.messageLog.count({ where: { template: "rdv_rappel_j1", statut: "ENVOYE" } })).toBe(1);
  });
});
