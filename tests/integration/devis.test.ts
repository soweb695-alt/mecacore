import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { creerDevis, modifierDevis, rejeterDevis, rouvrirDevis, validerDevis } from "@/lib/services/devis";
import { enregistrerRdv } from "@/lib/services/rdv";
import type { LigneInput } from "@/lib/validators/devis";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

type Base = Awaited<ReturnType<typeof seedBase>>;
let b: Base;

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

const mecanique = (lignes: LigneInput[]) => creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes });

describe("création et statut", () => {
  it("un devis créé est un « Brouillon » (il ne devient « Envoyé » qu'après un envoi par e-mail réussi)", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 1)]);
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("BROUILLON");
  });

  it("reste modifiable tant qu'il n'est pas validé ou rejeté", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 1)]);
    await modifierDevis(id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 2)] });
    expect(await db.ligneDevis.findFirstOrThrow({ where: { devisId: id } })).toMatchObject({ quantite: expect.anything() });
    await validerDevis(id, creneau(b.meca.id));
    await expect(modifierDevis(id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] })).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("enregistre le kilométrage et la date de CT sur le véhicule et le devis", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, kilometrage: 84200, prochainCT: "2027-05-10", lignes: [ligne(b.p1.id, 1)] });
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).kilometrage).toBe(84200);
    const v = await db.vehicule.findUniqueOrThrow({ where: { id: b.vehicule.id } });
    expect(v.kilometrage).toBe(84200);
    expect(v.prochainCT?.toISOString().slice(0, 10)).toBe("2027-05-10");
  });
});

describe("véhicule d'abord, client associé ensuite", () => {
  it("associe le client du devis à un véhicule sans propriétaire", async () => {
    const libre = await db.vehicule.create({ data: { immatriculation: "ZZ-111-ZZ", marque: "Fiat", modele: "Panda" } });
    expect(libre.clientId).toBeNull();
    await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: libre.id, lignes: [ligne(b.p1.id, 1)] });
    expect((await db.vehicule.findUniqueOrThrow({ where: { id: libre.id } })).clientId).toBe(b.client.id);
  });

  it("refuse un véhicule appartenant à un autre client", async () => {
    const autre = await db.client.create({ data: { type: "PARTICULIER", lastName: "Autre" } });
    await expect(creerDevis(b.user.id, { type: "MECANIQUE", clientId: autre.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] })).rejects.toMatchObject({ code: "VEHICULE_INVALIDE" });
  });

  it("accepte un devis de pièces avec ou sans véhicule", async () => {
    await expect(creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] })).resolves.toBeDefined();
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).vehiculeId).toBe(b.vehicule.id);
  });
});

describe("validation d'un devis mécanique", () => {
  it("décrémente le stock, crée l'OR assigné et place le rendez-vous au planning du technicien", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 3), { type: "MAIN_OEUVRE", designation: "Pose", quantite: 1.5, prixUnitaireHT: 65, tvaRate: 20 }]);
    const res = await validerDevis(id, { mecanicienId: b.meca.id, rdv: { debut: "2027-01-12T09:00", fin: "2027-01-12T11:00" } });

    expect(res.ordre?.numero).toMatch(/^OR-\d{4}-0001$/);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(2);
    const devis = await db.devis.findUniqueOrThrow({ where: { id }, include: { ordre: { include: { taches: true } }, rendezVous: true } });
    expect(devis.statut).toBe("VALIDE");
    expect(devis.ordre).toMatchObject({ statut: "EN_ATTENTE_SIGNATURE", userId: b.meca.id });
    expect(devis.ordre?.taches).toHaveLength(1);
    expect(devis.rendezVous).toHaveLength(1);
    expect(devis.rendezVous[0]).toMatchObject({ userId: b.meca.id, vehiculeId: b.vehicule.id, clientId: b.client.id, statut: "PLANIFIE" });
    expect(devis.rendezVous[0].debut.toISOString()).toBe("2027-01-12T08:00:00.000Z"); // 09:00 Paris (hiver)
  });

  it("exige le technicien et le créneau", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 1)]);
    await expect(validerDevis(id, {})).rejects.toMatchObject({ code: "TECHNICIEN_REQUIS" });
    await expect(validerDevis(id, { mecanicienId: b.meca.id })).rejects.toMatchObject({ code: "RDV_REQUIS" });
    await expect(validerDevis(id, { mecanicienId: b.user.id, rdv: { debut: "2027-01-12T09:00", fin: "2027-01-12T10:00" } })).rejects.toMatchObject({ code: "MECANICIEN_INVALIDE" });
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("BROUILLON");
  });

  it("refuse tout si le créneau du technicien est pris (aucun changement de stock, d'OR ni de statut)", async () => {
    await enregistrerRdv({ clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id, debut: "2027-01-12T09:30", fin: "2027-01-12T10:30" });
    const { id } = await mecanique([ligne(b.p1.id, 3)]);
    const err = await validerDevis(id, { mecanicienId: b.meca.id, rdv: { debut: "2027-01-12T09:00", fin: "2027-01-12T10:00" } }).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: "CONFLIT_RDV" });
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(5);
    expect(await db.ordreReparation.count()).toBe(0);
    expect(await db.rendezVous.count()).toBe(1);
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("BROUILLON");
  });

  it("valide malgré un stock insuffisant : le stock devient négatif et les pénuries sont renvoyées", async () => {
    const { id } = await mecanique([ligne(b.p2.id, 2, 10), ligne(b.p1.id, 4)]);
    await db.piece.update({ where: { id: b.p1.id }, data: { stock: 1 } });

    const r = await validerDevis(id, creneau(b.meca.id));
    expect(r.penuries).toEqual([expect.objectContaining({ reference: "P1", demande: 4, disponible: 1 })]);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(-3);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p2.id } })).stock).toBe(3);
    expect(await db.ordreReparation.count()).toBe(1);
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("VALIDE");
    // Rouvrir restitue exactement ce qui a été décrémenté.
    await rouvrirDevis(id);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(1);
  });

  it("accepte une pièce dont la quantité dépasse le stock (alerte renvoyée, pas de blocage)", async () => {
    const r = await mecanique([ligne(b.p1.id, 6)]);
    expect(r.penuries).toEqual([expect.objectContaining({ reference: "P1", demande: 6, disponible: 5 })]);
    expect(r.statut).toBe("BROUILLON");
  });

  it("refuse toujours une pièce désactivée", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { isActive: false } });
    await expect(mecanique([ligne(b.p1.id, 1)])).rejects.toMatchObject({ code: "PIECE_INTROUVABLE" });
  });

  it("seuil d'alerte pris en compte (par défaut) : bon de commande automatique ; décoché : aucun", async () => {
    const avec = await mecanique([ligne(b.p1.id, 3)]);
    expect((await validerDevis(avec.id, creneau(b.meca.id))).reappro).toHaveLength(1); // stock 2 = seuil
    await db.bonCommande.deleteMany();
    await db.piece.update({ where: { id: b.p2.id }, data: { stock: 5 } });
    const sans = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, priseEnCompteSeuil: false, lignes: [ligne(b.p2.id, 4)] });
    expect((await db.devis.findUniqueOrThrow({ where: { id: sans.id } })).priseEnCompteSeuil).toBe(false);
    expect((await validerDevis(sans.id, creneau(b.meca.id))).reappro).toHaveLength(0);
    expect(await db.bonCommande.count()).toBe(0);
  });

  it("« Enregistrer en brouillon » repasse un devis envoyé en brouillon ; sans l'option, le statut ne change pas", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 1)]);
    await db.devis.update({ where: { id }, data: { statut: "ENVOYE" } });
    const base = { type: "MECANIQUE" as const, clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 2)] };
    expect((await modifierDevis(id, base)).statut).toBe("ENVOYE");
    expect((await modifierDevis(id, { ...base, brouillon: true })).statut).toBe("BROUILLON");
  });

  it("ne décrémente le stock qu'une seule fois en cas de validations concurrentes", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 3)]);
    const [r1, r2] = await Promise.allSettled([validerDevis(id, creneau(b.meca.id)), validerDevis(id, creneau(b.meca.id))]);
    expect([r1, r2].filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(2);
    expect(await db.ordreReparation.count()).toBe(1);
    expect(await db.rendezVous.count()).toBe(1);
  });

  it("n'autorise plus la validation d'un devis rejeté", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 1)]);
    await rejeterDevis(id, "Trop cher");
    await expect(validerDevis(id, creneau(b.meca.id))).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });
});

describe("validation d'un devis de pièces", () => {
  it("décrémente le stock et crée un bon de livraison « en attente » (pas d'OR, pas de rendez-vous)", async () => {
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 2), ligne(b.p2.id, 1, 10)] });
    const res = await validerDevis(id);
    expect(res.ordre).toBeNull();
    expect(res.bonLivraison?.numero).toMatch(/^BL-\d{4}-0001$/);
    expect(await db.ordreReparation.count()).toBe(0);
    expect(await db.rendezVous.count()).toBe(0);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(3);
    const bl = await db.bonLivraison.findUniqueOrThrow({ where: { devisId: id }, include: { lignes: true } });
    expect(bl).toMatchObject({ statut: "EN_ATTENTE", clientId: b.client.id });
    expect(bl.lignes).toHaveLength(2);
  });
});

describe("réapprovisionnement automatique", () => {
  it("crée un bon de commande « en attente » quand une pièce atteint le seuil, sans doublon", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { fournisseur: "Autodis" } });
    const a = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 3)] }); // stock 5 → 2 (= seuil)
    const r = await validerDevis(a.id);
    expect(r.reappro).toHaveLength(1);
    const bc = await db.bonCommande.findFirstOrThrow({ include: { lignes: true } });
    expect(bc).toMatchObject({ statut: "EN_ATTENTE", automatique: true, fournisseur: "Autodis" });
    expect(bc.lignes).toEqual([expect.objectContaining({ pieceId: b.p1.id, quantite: 2 })]); // 2 × seuil (2) − stock (2) = 2

    const c = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    expect((await validerDevis(c.id)).reappro).toHaveLength(0); // déjà en commande
    expect(await db.bonCommande.count()).toBe(1);
  });

  it("regroupe par fournisseur et utilise « À définir » sans fournisseur", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { fournisseur: "Autodis" } });
    await db.piece.update({ where: { id: b.p2.id }, data: { fournisseur: null } });
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 4), ligne(b.p2.id, 4)] });
    await validerDevis(id);
    const bcs = await db.bonCommande.findMany({ orderBy: { fournisseur: "asc" } });
    expect(bcs.map((x) => x.fournisseur)).toEqual(["Autodis", "À définir"]);
  });

  it("ne commande rien pour une pièce sans seuil d'alerte", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { seuilAlerte: 0 } });
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 5)] });
    expect((await validerDevis(id)).reappro).toHaveLength(0);
  });
});

describe("réouverture par l'admin", () => {
  it("restaure le stock et retire OR et rendez-vous", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 3)]);
    await validerDevis(id, creneau(b.meca.id));
    await rouvrirDevis(id);
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(5);
    expect(await db.ordreReparation.count()).toBe(0);
    expect(await db.rendezVous.count()).toBe(0);
    expect((await db.devis.findUniqueOrThrow({ where: { id } })).statut).toBe("ENVOYE");
  });

  it("retire le bon de livraison non prêt, refuse s'il est déjà prêt", async () => {
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p2.id, 1, 10)] });
    await validerDevis(id);
    await db.bonLivraison.updateMany({ where: { devisId: id }, data: { statut: "PRETE" } });
    await expect(rouvrirDevis(id)).rejects.toMatchObject({ code: "BL_PRET" });
    await db.bonLivraison.updateMany({ where: { devisId: id }, data: { statut: "EN_ATTENTE" } });
    await rouvrirDevis(id);
    expect(await db.bonLivraison.count()).toBe(0);
  });
});

describe("numérotation et calculs", () => {
  it("incrémente les numéros de devis sans trou", async () => {
    const a = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    const c = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    const annee = new Date().getFullYear();
    expect(a.numero).toBe(`DEV-${annee}-0001`);
    expect(c.numero).toBe(`DEV-${annee}-0002`);
  });

  it("calcule les totaux côté serveur", async () => {
    const { id } = await mecanique([ligne(b.p1.id, 2, 49.9), { type: "MAIN_OEUVRE", designation: "MO", quantite: 1.5, prixUnitaireHT: 65, tvaRate: 20 }]);
    const d = await db.devis.findUniqueOrThrow({ where: { id } });
    expect(Number(d.totalHT)).toBe(197.3);
    expect(Number(d.totalTVA)).toBe(39.46);
    expect(Number(d.totalTTC)).toBe(236.76);
  });

  it("génère des numéros uniques sous charge concurrente", async () => {
    const res = await Promise.all(Array.from({ length: 8 }, () => creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] })));
    expect(new Set(res.map((r) => r.numero)).size).toBe(8);
  });
});
