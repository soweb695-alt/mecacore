import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { PUT as facturationPut } from "@/app/api/parametres/facturation/route";
import { PUT as communicationPut } from "@/app/api/parametres/communication/route";
import { PUT as stockPut } from "@/app/api/parametres/stock/route";
import { POST as categoriePost } from "@/app/api/categories-pieces/route";
import { DELETE as categorieDelete, PATCH as categoriePatch } from "@/app/api/categories-pieces/[id]/route";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { envoyerVehiculePret } from "@/lib/services/emails-client";
import { creerFactureDepuisDevis, enregistrerPaiement } from "@/lib/services/factures";
import { importerPieces } from "@/lib/services/import-pieces";
import { parametresClient } from "@/lib/parametres";
import { pdfDevis } from "@/lib/pdf/devis";
import { pdfFacture } from "@/lib/pdf/facture";
import { MENTIONS_FACTURE_DEFAUT } from "@/lib/validators/parametres";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const admin = (): CurrentUser => ({ id: b.user.id, role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" });
const sec = (): CurrentUser => ({ id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" });

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

const facturation = {
  modesPaiement: ["CB", "VIREMENT"],
  delaiPaiementDefaut: 15,
  prefixDevis: "dv",
  prefixFacture: "FA",
  prefixBonLivraison: "LIV",
  mentionsFacture: "CGV : paiement à réception.\nPénalités : 3 fois le taux légal.",
  affichageRemise: "LIGNE",
};

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = admin();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Paramètres › Facturation", () => {
  it("enregistre les réglages, réservés à l'administrateur ; les préfixes servent aux prochains numéros", async () => {
    expect((await facturationPut(req("/api/parametres/facturation", "PUT", facturation), ctx())).status).toBe(200);
    const g = await db.parametreGarage.findUniqueOrThrow({ where: { id: 1 } });
    expect(g).toMatchObject({ modesPaiement: ["CB", "VIREMENT"], delaiPaiementDefaut: 15, prefixDevis: "DV", prefixFacture: "FA", prefixBonLivraison: "LIV", affichageRemise: "LIGNE" });
    expect(g.mentionsFacture).toContain("CGV");
    const { numero } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    expect(numero).toMatch(/^DV-\d{4}-0001$/);
    expect(await parametresClient()).toMatchObject({ modesPaiement: ["CB", "VIREMENT"], delaiPaiementDefaut: 15 });

    courant = sec();
    expect((await facturationPut(req("/api/parametres/facturation", "PUT", facturation), ctx())).status).toBe(403);
  });

  it("refuse un préfixe invalide, des préfixes identiques, aucun mode de paiement et un délai hors liste", async () => {
    const statut = async (b: object) => (await facturationPut(req("/api/parametres/facturation", "PUT", { ...facturation, ...b }), ctx())).status;
    expect(await statut({ prefixFacture: "FA C" })).toBe(400);
    expect(await statut({ prefixFacture: "DV" })).toBe(400);
    expect(await statut({ modesPaiement: [] })).toBe(400);
    expect(await statut({ delaiPaiementDefaut: 20 })).toBe(400);
  });

  it("le texte par défaut des mentions n'est pas figé en base", async () => {
    await facturationPut(req("/api/parametres/facturation", "PUT", { ...facturation, mentionsFacture: MENTIONS_FACTURE_DEFAUT }), ctx());
    expect((await db.parametreGarage.findUniqueOrThrow({ where: { id: 1 } })).mentionsFacture).toBeNull();
  });

  it("un paiement dans un mode non accepté est refusé ; la facture imprime les modes acceptés et les mentions", async () => {
    await facturationPut(req("/api/parametres/facturation", "PUT", facturation), ctx());
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    await validerDevis(id, {});
    const f = await creerFactureDepuisDevis(id, b.user.id);
    await expect(enregistrerPaiement(f.id, { montant: 10, mode: "ESPECES", nombreFois: null, reference: "" })).rejects.toMatchObject({ code: "MODE_NON_ACCEPTE" });
    await enregistrerPaiement(f.id, { montant: 10, mode: "CB", nombreFois: null, reference: "" });
    const t = textePdf((await pdfFacture(f.id))!.pdf);
    expect(t).toContain("Modes de paiement accept");
    expect(t).toContain("Carte bancaire, Virement");
    expect(t).toContain("CGV : paiement");
    expect(t).not.toContain("indemnit");
  });

  describe("affichage de la remise professionnelle sur les PDF", () => {
    // Pièce à 50 € HT catalogue vendue 45 € HT (remise PRO 10 %), quantité 2.
    async function devisRemise() {
      await db.client.update({ where: { id: b.client.id }, data: { type: "PRO", companyName: "Pro SA", discountRate: 10 } });
      const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [{ ...ligne(b.p1.id, 2, 45), prixCatalogueHT: 50 }] });
      return id;
    }
    const pdfAvec = async (id: string, affichageRemise: string) => {
      await db.parametreGarage.update({ where: { id: 1 }, data: { affichageRemise: affichageRemise as "LIGNE" } });
      return textePdf((await pdfDevis(id))!.pdf);
    };

    it("par ligne : prix catalogue et taux sous la pièce", async () => {
      const t = await pdfAvec(await devisRemise(), "LIGNE");
      expect(t).toContain("remise professionnelle 10 %");
      expect(t).not.toContain("Remise PRO");
    });

    it("dans le total : ligne au prix catalogue, puis « Remise PRO » avant le total HT, totaux inchangés", async () => {
      const id = await devisRemise();
      const t = await pdfAvec(id, "TOTAL");
      expect(t).not.toContain("remise professionnelle");
      expect(t).toContain("Total HT brut");
      expect(t).toMatch(/100,00/); // 2 × 50 € HT catalogue
      expect(t).toContain("Remise PRO");
      expect(t).toMatch(/- 10,00/);
      expect(t).toMatch(/90,00/); // total HT réel, inchangé
      const d = await db.devis.findUniqueOrThrow({ where: { id } });
      expect(Number(d.totalHT)).toBe(90);
    });

    it("masquée : prix net seul, aucune mention de remise", async () => {
      const t = await pdfAvec(await devisRemise(), "MASQUER");
      expect(t).not.toMatch(/remise/i);
      expect(t).not.toContain("100,00");
    });
  });
});

describe("Paramètres › Communication", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubEnv("BREVO_SENDER_EMAIL", "hebergeur@example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  const communication = {
    expediteurNom: "Garage du Centre",
    expediteurEmail: "Contact@Garage.fr",
    vehiculePret: { sujet: "{{immatriculation}} est prêt", corps: "Bonjour {{client_nom}},\n\n{{garage_nom}}" },
    rappelRdv: { sujet: "", corps: "" },
  };

  it("enregistre l'expéditeur et les modèles ; l'e-mail « Véhicule prêt » les utilise", async () => {
    expect((await communicationPut(req("/api/parametres/communication", "PUT", communication), ctx())).status).toBe(200);
    const g = await db.parametreGarage.findUniqueOrThrow({ where: { id: 1 } });
    expect(g).toMatchObject({ expediteurNom: "Garage du Centre", expediteurEmail: "contact@garage.fr", emailRappelRdvSujet: null });

    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    const { ordre } = await validerDevis(id, creneau(b.meca.id));
    await envoyerVehiculePret(ordre!.id);
    const mail = JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string);
    expect(mail.sender).toEqual({ email: "contact@garage.fr", name: "Garage du Centre" });
    expect(mail.subject).toBe("AB-123-CD est prêt");
    expect(mail.htmlContent).toBe("<p>Bonjour Jean Durand,</p><p>Garage Test</p>");
  });

  it("sans expéditeur saisi : adresse de l'hébergeur et nom du garage", async () => {
    await communicationPut(req("/api/parametres/communication", "PUT", { ...communication, expediteurNom: "", expediteurEmail: "" }), ctx());
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    const { ordre } = await validerDevis(id, creneau(b.meca.id));
    await envoyerVehiculePret(ordre!.id);
    const mail = JSON.parse(vi.mocked(fetch).mock.calls.at(-1)![1]!.body as string);
    expect(mail.sender).toEqual({ email: "hebergeur@example.com", name: "Garage Test" });
  });

  it("refuse une adresse d'expéditeur invalide", async () => {
    expect((await communicationPut(req("/api/parametres/communication", "PUT", { ...communication, expediteurEmail: "pas-une-adresse" }), ctx())).status).toBe(400);
  });
});

describe("Paramètres › Stocks & alertes", () => {
  it("seuil par défaut : enregistré et appliqué aux pièces créées par import (sans seuil dans le fichier)", async () => {
    expect((await stockPut(req("/api/parametres/stock", "PUT", { seuilAlerteDefaut: 7 }), ctx())).status).toBe(200);
    expect((await parametresClient()).seuilAlerteDefaut).toBe(7);
    await importerPieces(admin(), [["reference", "nom", "prixVenteHT"], ["IMP-1", "Bougie", "8"]], true);
    expect((await db.piece.findUniqueOrThrow({ where: { reference: "IMP-1" } })).seuilAlerte).toBe(7);
    expect((await stockPut(req("/api/parametres/stock", "PUT", { seuilAlerteDefaut: -1 }), ctx())).status).toBe(400);
  });

  it("catégories : ajout, doublon refusé, renommage (les pièces suivent), ordre, suppression (les pièces gardent la leur)", async () => {
    const r = await categoriePost(req("/api/categories-pieces", "POST", { libelle: "Échappement" }), ctx());
    expect(r.status).toBe(200);
    const { id } = (await r.json()).data;
    expect((await categoriePost(req("/api/categories-pieces", "POST", { libelle: "échappement" }), ctx())).status).toBe(409);
    expect((await parametresClient()).categories).toEqual(["Échappement"]);

    await db.piece.update({ where: { id: b.p1.id }, data: { categorie: "Échappement" } });
    expect((await categoriePatch(req(`/api/categories-pieces/${id}`, "PATCH", { libelle: "Échappement & silencieux" }), ctx({ id }))).status).toBe(200);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).categorie).toBe("Échappement & silencieux");

    const deux = (await (await categoriePost(req("/api/categories-pieces", "POST", { libelle: "Batterie" }), ctx())).json()).data.id;
    await categoriePatch(req(`/api/categories-pieces/${deux}`, "PATCH", { deplacer: "haut" }), ctx({ id: deux }));
    expect((await parametresClient()).categories).toEqual(["Batterie", "Échappement & silencieux"]);

    expect((await categorieDelete(req(`/api/categories-pieces/${id}`, "DELETE"), ctx({ id }))).status).toBe(200);
    expect((await parametresClient()).categories).toEqual(["Batterie"]);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).categorie).toBe("Échappement & silencieux");

    courant = sec();
    expect((await categoriePost(req("/api/categories-pieces", "POST", { libelle: "Pneus" }), ctx())).status).toBe(403);
  });
});
