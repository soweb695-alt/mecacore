import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { envoyerDevisParEmail } from "@/lib/services/devis-email";
import { envoyerBonLivraisonParEmail, marquerLivre, marquerPrete } from "@/lib/services/bl";
import { creerBonLivraison } from "@/lib/services/bl";
import { analyser } from "@/lib/services/analyse";
import { creerFactureDepuisBons, creerFactureDepuisDevis } from "@/lib/services/factures";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const devisPieces = (pieceId: string, qte = 1, pu = 50, clientId = b.client.id) => creerDevis(b.user.id, { type: "PIECE", clientId, lignes: [ligne(pieceId, qte, pu)] });

describe("envoi du devis par e-mail", () => {
  it("reste « Brouillon » sans clé Brevo (simulation) et rend une erreur explicite", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const { id } = await devisPieces(b.p1.id);
    await expect(envoyerDevisParEmail(id)).rejects.toMatchObject({ code: "EMAIL_NON_CONFIGURE" });
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("BROUILLON");
  });

  it("passe à « Envoyé » seulement si Brevo confirme, avec le PDF en pièce jointe", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubEnv("BREVO_SENDER_EMAIL", "garage@example.com");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { id, numero } = await devisPieces(b.p1.id);
    await envoyerDevisParEmail(id);
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("ENVOYE");
    const corps = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corps.to).toEqual([{ email: "j@d.fr" }]);
    expect(corps.attachment[0].name).toBe(`${numero}.pdf`);
    expect(Buffer.from(corps.attachment[0].content, "base64").subarray(0, 4).toString()).toBe("%PDF");
    expect(await db.messageLog.count({ where: { template: "devis", statut: "ENVOYE" } })).toBe(1);
  });

  it("reste « Brouillon » si l'envoi échoue", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { id } = await devisPieces(b.p1.id);
    await expect(envoyerDevisParEmail(id)).rejects.toMatchObject({ code: "EMAIL_ECHEC" });
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("BROUILLON");
  });

  it("exige une adresse e-mail et refuse un devis déjà traité", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { email: null } });
    const { id } = await devisPieces(b.p1.id);
    await expect(envoyerDevisParEmail(id)).rejects.toMatchObject({ code: "EMAIL_MANQUANT" });
    await db.client.update({ where: { id: b.client.id }, data: { email: "j@d.fr" } });
    await validerDevis(id);
    await expect(envoyerDevisParEmail(id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });
});

describe("bons de livraison : prêt → livré", () => {
  it("suit En attente → Prêt à être retiré → Livré, dans cet ordre uniquement", async () => {
    const { id } = await devisPieces(b.p1.id);
    await validerDevis(id);
    const bl = await db.bonLivraison.findFirstOrThrow();
    await expect(marquerLivre(bl.id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
    await marquerPrete(bl.id);
    await expect(marquerPrete(bl.id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
    await marquerLivre(bl.id);
    const fin = await db.bonLivraison.findUniqueOrThrow({ where: { id: bl.id } });
    expect(fin.statut).toBe("LIVREE");
    expect(fin.livreLe).toBeInstanceOf(Date);
  });
});

describe("envoi automatique du BL au passage « Livré »", () => {
  async function blPret() {
    const { id } = await devisPieces(b.p1.id);
    await validerDevis(id);
    const bl = await db.bonLivraison.findUniqueOrThrow({ where: { devisId: id } });
    await marquerPrete(bl.id);
    return bl;
  }

  it("envoie le PDF (sans prix) au client et trace l'envoi dans son historique", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const bl = await blPret();
    const r = await marquerLivre(bl.id);
    expect(r.email).toEqual({ resultat: "envoye", destinataire: "j@d.fr" });
    const corps = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corps.attachment[0].name).toBe(`${bl.numero}.pdf`);
    expect(Buffer.from(corps.attachment[0].content, "base64").subarray(0, 4).toString()).toBe("%PDF");
    const log = await db.messageLog.findFirstOrThrow({ where: { template: "bon_livraison" } });
    expect(log).toMatchObject({ clientId: b.client.id, canal: "EMAIL", statut: "ENVOYE", destinataire: "j@d.fr" });
  });

  it("le BL passe « Livré » même si Brevo n'est pas configuré, avec un résultat explicite", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const bl = await blPret();
    const r = await marquerLivre(bl.id);
    expect(r.email.resultat).toBe("non_configure");
    expect((await db.bonLivraison.findUniqueOrThrow({ where: { id: bl.id } })).statut).toBe("LIVREE");
  });

  it("le BL passe « Livré » si l'envoi échoue, et peut être renvoyé ensuite", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const bl = await blPret();
    expect((await marquerLivre(bl.id)).email.resultat).toBe("echec");
    expect((await db.bonLivraison.findUniqueOrThrow({ where: { id: bl.id } })).statut).toBe("LIVREE");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect((await envoyerBonLivraisonParEmail(bl.id)).resultat).toBe("envoye");
    expect(await db.messageLog.count({ where: { template: "bon_livraison" } })).toBe(2); // une trace par tentative
  });

  it("signale un client sans adresse e-mail sans bloquer la livraison", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { email: null } });
    const bl = await blPret();
    const r = await marquerLivre(bl.id);
    expect(r.email).toEqual({ resultat: "sans_email", destinataire: null });
    expect((await db.bonLivraison.findUniqueOrThrow({ where: { id: bl.id } })).statut).toBe("LIVREE");
    expect(await db.messageLog.count()).toBe(0);
  });
});

describe("facturation groupée des bons de livraison", () => {
  async function blLivre(pieceId: string, qte: number, pu = 50, clientId = b.client.id) {
    const { id } = await devisPieces(pieceId, qte, pu, clientId);
    await validerDevis(id);
    const bl = await db.bonLivraison.findUniqueOrThrow({ where: { devisId: id } });
    await marquerPrete(bl.id);
    await marquerLivre(bl.id);
    return { devisId: id, blId: bl.id };
  }

  it("regroupe plusieurs bons livrés d'un même client en une seule facture (prix des devis)", async () => {
    const a = await blLivre(b.p1.id, 1, 50); // 50 HT
    const c = await blLivre(b.p2.id, 2, 10); // 20 HT
    const f = await creerFactureDepuisBons([a.blId, c.blId], b.user.id);
    const facture = await db.facture.findUniqueOrThrow({ where: { id: f.id }, include: { lignes: true, bonsLivraison: true } });
    expect(facture.devisId).toBeNull();
    expect(facture.userId).toBe(b.user.id);
    expect(facture.bonsLivraison).toHaveLength(2);
    expect(facture.lignes).toHaveLength(2);
    expect(Number(facture.totalHT)).toBe(70);
    expect(Number(facture.totalTTC)).toBe(84);
    expect(facture.lignes.every((l) => l.pieceId)).toBe(true);
    expect(facture.statutPA).toContain("simulation");
  });

  it("refuse un bon non livré, déjà facturé ou d'un autre client", async () => {
    const livre = await blLivre(b.p1.id, 1);
    const { id } = await devisPieces(b.p2.id, 1, 10);
    await validerDevis(id);
    const attente = await db.bonLivraison.findUniqueOrThrow({ where: { devisId: id } });
    await expect(creerFactureDepuisBons([livre.blId, attente.id], b.user.id)).rejects.toMatchObject({ code: "NON_LIVRE" });

    const autre = await db.client.create({ data: { type: "PARTICULIER", lastName: "Autre" } });
    const bAutre = await blLivre(b.p2.id, 1, 10, autre.id);
    await expect(creerFactureDepuisBons([livre.blId, bAutre.blId], b.user.id)).rejects.toMatchObject({ code: "CLIENTS_DIFFERENTS" });

    await creerFactureDepuisBons([livre.blId], b.user.id);
    await expect(creerFactureDepuisBons([livre.blId], b.user.id)).rejects.toMatchObject({ code: "DEJA_FACTURE" });
    await expect(creerFactureDepuisDevis(livre.devisId, b.user.id)).rejects.toMatchObject({ code: "DEJA_FACTURE" });
  });

  it("facture un bon créé à la main au prix de vente actuel, remise professionnelle comprise", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { type: "PRO", companyName: "Garage Pro", discountRate: 10 } });
    const bl = await creerBonLivraison({ clientId: b.client.id, lignes: [{ pieceId: b.p1.id, quantite: 2 }] });
    await marquerPrete(bl.id);
    await marquerLivre(bl.id);
    const f = await creerFactureDepuisBons([bl.id], b.user.id);
    const facture = await db.facture.findUniqueOrThrow({ where: { id: f.id }, include: { lignes: true } });
    expect(Number(facture.lignes[0].prixUnitaireHT)).toBe(45); // 50 − 10 %
    expect(Number(facture.totalHT)).toBe(90);
    expect(Number(facture.remisePro)).toBe(10);
  });

  it("une facture directe depuis le devis rattache aussi son bon (plus regroupable ensuite)", async () => {
    const { devisId, blId } = await blLivre(b.p1.id, 1);
    const f = await creerFactureDepuisDevis(devisId, b.user.id);
    expect((await db.bonLivraison.findUniqueOrThrow({ where: { id: blId } })).factureId).toBe(f.id);
    await expect(creerFactureDepuisBons([blId], b.user.id)).rejects.toMatchObject({ code: "DEJA_FACTURE" });
  });
});

describe("rendez-vous créé à la validation, devis mécanique non facturé deux fois", () => {
  it("garde le lien devis ↔ rendez-vous", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    await validerDevis(id, creneau(b.meca.id));
    expect(await db.rendezVous.count({ where: { devisId: id } })).toBe(1);
  });
});

describe("couleur des collaborateurs", () => {
  it("l'analyse reprend la couleur attribuée (ou une couleur automatique à défaut)", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    await validerDevis(id, creneau(b.meca.id));
    await db.ordreReparation.updateMany({ data: { statut: "A_TRAITER_MAGASIN" } });
    await creerFactureDepuisDevis(id, b.user.id);

    expect((await analyser("mois")).parCollaborateur[0].couleur).toMatch(/^#[0-9a-f]{6}$/); // automatique
    await db.user.update({ where: { id: b.meca.id }, data: { couleur: "#ff00aa" } });
    expect((await analyser("mois")).parCollaborateur[0]).toMatchObject({ nom: "Meca Test", couleur: "#ff00aa" });
  });
});
