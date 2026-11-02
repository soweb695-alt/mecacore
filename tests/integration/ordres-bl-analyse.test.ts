import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { rechercherClients } from "@/lib/services/clients";
import { rechercherPieces, compterAlertes, piecesEnAlerte } from "@/lib/services/pieces";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { creerFactureDepuisDevis, annulerFacture, enregistrerPaiement } from "@/lib/services/factures";
import { enregistrerFiche, obtenirFiche } from "@/lib/services/fiche-controle";
import { accesOrdre, ajouterPhoto, demarrerTravaux, enregistrerSignature, terminerOrdre } from "@/lib/services/ordres";
import { creerBonCommande, creerBonLivraison, marquerPrete, receptionnerBonCommande } from "@/lib/services/bl";
import { analyser, bornesPeriode } from "@/lib/services/analyse";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function ordreValide() {
  const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1, 50), { type: "MAIN_OEUVRE", designation: "MO", quantite: 1, prixUnitaireHT: 65, tvaRate: 20 }] });
  const r = await validerDevis(id, creneau(b.meca.id));
  return { devisId: id, ordreId: r.ordre!.id };
}

describe("ordres de réparation : signature, travaux et clôture", () => {
  it("applique les règles de signature, de démarrage et de fin des travaux", async () => {
    const { ordreId } = await ordreValide();
    await expect(demarrerTravaux(ordreId)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
    await expect(enregistrerSignature(ordreId, "pas-une-image")).rejects.toMatchObject({ code: "SIGNATURE_INVALIDE" });
    await enregistrerSignature(ordreId, PNG);
    await expect(enregistrerSignature(ordreId, PNG)).rejects.toMatchObject({ code: "DEJA_SIGNE" });

    await demarrerTravaux(ordreId);
    expect((await db.ordreReparation.findUniqueOrThrow({ where: { id: ordreId } })).statut).toBe("EN_COURS");
    await expect(demarrerTravaux(ordreId)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });

    // La fin des travaux exige la fiche de contrôle validée.
    await expect(terminerOrdre(ordreId, 84_000)).rejects.toMatchObject({ code: "FICHE_NON_VALIDEE" });
    const fiche = await obtenirFiche(ordreId);
    await enregistrerFiche(ordreId, { id: b.meca.id, role: "MECANICIEN" }, { points: fiche.points.map((p) => ({ id: p.id, resultat: "OK" })), remarques: "", valider: true });
    await terminerOrdre(ordreId, 84_000);
    const o = await db.ordreReparation.findUniqueOrThrow({ where: { id: ordreId } });
    expect(o).toMatchObject({ statut: "A_TRAITER_MAGASIN", kilometrage: 84_000 });
    expect((await db.vehicule.findUniqueOrThrow({ where: { id: b.vehicule.id } })).kilometrage).toBe(84_000);
    await expect(terminerOrdre(ordreId, 84_000)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("limite l'accès d'un mécanicien à ses propres ordres", async () => {
    const { ordreId } = await ordreValide();
    await expect(accesOrdre({ id: b.meca.id, role: "MECANICIEN" }, ordreId)).resolves.toBeDefined();
    await expect(accesOrdre({ id: "autre", role: "MECANICIEN" }, ordreId)).rejects.toMatchObject({ status: 403 });
    await expect(accesOrdre({ id: b.user.id, role: "SECRETARIAT" }, ordreId)).resolves.toBeDefined();
    await expect(accesOrdre({ id: b.user.id, role: "SECRETARIAT" }, "inconnu")).rejects.toMatchObject({ status: 404 });
  });

  it("n'accepte que de vraies images en photo", async () => {
    const { ordreId } = await ordreValide();
    const faux = new File([new Uint8Array([1, 2, 3, 4])], "x.png", { type: "image/png" });
    await expect(ajouterPhoto(ordreId, b.meca.id, faux)).rejects.toMatchObject({ code: "FORMAT_INVALIDE" });
    const png = new File([Buffer.from(PNG.split(",")[1], "base64")], "ok.png", { type: "image/png" });
    const r = await ajouterPhoto(ordreId, b.meca.id, png);
    expect(r.url).toMatch(new RegExp(`^photos/${ordreId}/[0-9a-f-]{36}\\.png$`));
    expect(await db.photoOR.count()).toBe(1);
  });
});

describe("commandes et livraisons", () => {
  it("réceptionne partiellement puis totalement, sans dépasser la commande", async () => {
    const { id } = await creerBonCommande({ fournisseur: "Autodis", lignes: [{ pieceId: b.p1.id, quantite: 10 }] });
    const ligneId = (await db.ligneBonCommande.findFirstOrThrow({ where: { bonCommandeId: id } })).id;
    expect((await receptionnerBonCommande(id, [{ ligneId, quantite: 4 }])).statut).toBe("RECEPTIONNEE_PARTIELLE");
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(9);
    await expect(receptionnerBonCommande(id, [{ ligneId, quantite: 7 }])).rejects.toMatchObject({ code: "QUANTITE_INVALIDE" });
    expect((await receptionnerBonCommande(id, [{ ligneId, quantite: 6 }])).statut).toBe("RECEPTIONNEE");
    expect((await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } })).stock).toBe(15);
    await expect(receptionnerBonCommande(id, [{ ligneId, quantite: 1 }])).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("regroupe les pièces identiques sur un bon de livraison ; « commande prête » n'envoie plus de SMS", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { phone: "06 12 34 56 78" } });
    const bl = await creerBonLivraison({ clientId: b.client.id, lignes: [{ pieceId: b.p1.id, quantite: 1 }, { pieceId: b.p1.id, quantite: 2 }, { pieceId: b.p2.id, quantite: 1 }] });
    const lignes = await db.ligneBonLivraison.findMany({ where: { bonLivraisonId: bl.id } });
    expect(lignes).toHaveLength(2);
    expect(lignes.find((l) => l.pieceId === b.p1.id)?.quantite).toBe(3);
    await marquerPrete(bl.id);
    expect((await db.bonLivraison.findUniqueOrThrow({ where: { id: bl.id } })).statut).toBe("PRETE");
    expect(await db.messageLog.count()).toBe(0); // envoi automatique de SMS désactivé
    expect(lignes.every((l) => l.designation.includes("("))).toBe(true);
  });

  it("refuse un bon de commande pour une pièce inconnue", async () => {
    await expect(creerBonCommande({ fournisseur: "X", lignes: [{ pieceId: "inconnue", quantite: 1 }] })).rejects.toMatchObject({ code: "PIECE_INTROUVABLE" });
  });
});

describe("recherches et analyse", () => {
  it("recherche clients par nom, plaque et type", async () => {
    expect((await rechercherClients({ q: "durand", page: 1 })).total).toBe(1);
    expect((await rechercherClients({ q: "ab-123", page: 1 })).total).toBe(1);
    expect((await rechercherClients({ q: "zzz", page: 1 })).total).toBe(0);
    expect((await rechercherClients({ type: "PRO", page: 1 })).total).toBe(0);
  });

  it("recherche pièces (référence croisée, alerte de stock) et compte les alertes", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { stock: 1, referencesCroisees: ["TRW-1"] } });
    const admin = { id: "a", role: "ADMIN" as const };
    expect((await rechercherPieces(admin, { q: "trw-1", page: 1 })).total).toBe(1);
    const bas = await rechercherPieces(admin, { bas: true, page: 1 });
    expect(bas.items.map((p) => p.reference)).toEqual(["P1"]);
    expect(await compterAlertes()).toBe(1);
    expect((await piecesEnAlerte()).map((p) => p.nom)).toEqual(["Plaquettes"]);
  });

  it("calcule CA, marge, top pièces et CA par collaborateur", async () => {
    const { devisId } = await ordreValide();
    const f = await creerFactureDepuisDevis(devisId);
    const a = await analyser("mois");
    expect(a.caHT).toBe(115); // 50 + 65
    expect(a.marge).toBe(85); // 115 - 30 (coût d'achat de la pièce)
    expect(a.nbFactures).toBe(1);
    expect(a.parCollaborateur).toEqual([{ nom: "Meca Test", ca: 115, couleur: expect.stringMatching(/^#[0-9a-f]{6}$/) }]); // attribué au mécanicien de l'OR
    expect(a.topPieces[0]).toMatchObject({ reference: "P1", qte: 1, ca: 50, marge: 20 });
    expect(a.mois).toHaveLength(6);
    expect(a.mois.at(-1)?.ca).toBe(115);
    await annulerFacture(f.id);
    expect((await analyser("mois")).caHT).toBe(0);
  });

  it("n'annule pas une facture déjà payée en partie", async () => {
    const { devisId } = await ordreValide();
    const f = await creerFactureDepuisDevis(devisId);
    await enregistrerPaiement(f.id, { montant: 10, mode: "CB" });
    await expect(annulerFacture(f.id)).rejects.toMatchObject({ code: "PAIEMENTS_EXISTANTS" });
  });

  it("borne les périodes", () => {
    const m = bornesPeriode("mois", new Date("2026-10-25T10:00:00Z"));
    expect(m.du.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(m.au.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(bornesPeriode("trimestre", new Date("2026-11-10T10:00:00Z")).libelle).toContain("octobre");
    expect(bornesPeriode("annee", new Date("2026-11-10T10:00:00Z")).libelle).toBe("Année 2026");
  });
});
