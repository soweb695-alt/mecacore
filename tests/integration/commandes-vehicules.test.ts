import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { enregistrerPaiement, creerFactureDepuisDevis } from "@/lib/services/factures";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { creerBonCommande, modifierBonCommande, receptionnerBonCommande, supprimerBonCommande } from "@/lib/services/bl";
import { verifierReapprovisionnement } from "@/lib/services/reappro";
import { rechercherVehicules } from "@/lib/services/vehicules";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

describe("bons de commande automatiques", () => {
  it("restent modifiables et supprimables tant qu'ils ne sont pas réceptionnés", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { stock: 1 } });
    await db.$transaction((tx) => verifierReapprovisionnement(tx, [b.p1.id]));
    const bc = await db.bonCommande.findFirstOrThrow({ include: { lignes: true } });
    expect(bc).toMatchObject({ automatique: true, fournisseur: "À définir" });
    await modifierBonCommande(bc.id, { fournisseur: "Distrimo", lignes: [{ pieceId: b.p1.id, quantite: 6 }, { pieceId: b.p2.id, quantite: 2 }] });
    const maj = await db.bonCommande.findUniqueOrThrow({ where: { id: bc.id }, include: { lignes: true } });
    expect(maj.fournisseur).toBe("Distrimo");
    expect(maj.lignes).toHaveLength(2);
    await supprimerBonCommande(bc.id);
    expect(await db.bonCommande.count()).toBe(0);
  });

  it("ne sont plus modifiables après une réception", async () => {
    const { id } = await creerBonCommande({ fournisseur: "X", lignes: [{ pieceId: b.p1.id, quantite: 4 }] });
    const ligneId = (await db.ligneBonCommande.findFirstOrThrow({ where: { bonCommandeId: id } })).id;
    await receptionnerBonCommande(id, [{ ligneId, quantite: 1 }]);
    await expect(modifierBonCommande(id, { fournisseur: "Y", lignes: [{ pieceId: b.p1.id, quantite: 9 }] })).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
    await expect(supprimerBonCommande(id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("recommande à nouveau une pièce une fois le bon précédent réceptionné", async () => {
    await db.piece.update({ where: { id: b.p1.id }, data: { stock: 1 } });
    await db.$transaction((tx) => verifierReapprovisionnement(tx, [b.p1.id]));
    const bc = await db.bonCommande.findFirstOrThrow({ include: { lignes: true } });
    await receptionnerBonCommande(bc.id, bc.lignes.map((l) => ({ ligneId: l.id, quantite: l.quantite })));
    await db.piece.update({ where: { id: b.p1.id }, data: { stock: 0 } });
    const crees = await db.$transaction((tx) => verifierReapprovisionnement(tx, [b.p1.id]));
    expect(crees).toHaveLength(1);
    expect(await db.bonCommande.count()).toBe(2);
  });
});

describe("recherche de véhicules", () => {
  it("retrouve un véhicule par plaque (avec ou sans tirets), VIN ou nom du client, et renvoie le client", async () => {
    await db.vehicule.update({ where: { id: b.vehicule.id }, data: { vin: "VF3LCBHZ6JS123456", kilometrage: 84200, prochainCT: new Date("2027-05-10T12:00:00Z") } });
    for (const q of ["AB-123-CD", "ab123cd", "VF3LCB", "durand", "peugeot"]) {
      const r = await rechercherVehicules({ q });
      expect(r, q).toHaveLength(1);
      expect(r[0]).toMatchObject({ immatriculation: "AB-123-CD", kilometrage: 84200, prochainCT: "2027-05-10" });
      expect(r[0].client?.lastName).toBe("Durand");
    }
    expect(await rechercherVehicules({ q: "introuvable" })).toHaveLength(0);
  });

  it("liste aussi les véhicules sans client", async () => {
    await db.vehicule.create({ data: { immatriculation: "ZZ-111-ZZ", marque: "Fiat", modele: "Panda" } });
    const r = await rechercherVehicules({ q: "panda" });
    expect(r[0].client).toBeNull();
  });
});

describe("paiement en plusieurs fois", () => {
  it("mémorise le nombre d'échéances", async () => {
    const { id: devisId } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1, 50)] });
    await validerDevis(devisId, creneau(b.meca.id));
    const f = await creerFactureDepuisDevis(devisId);
    await enregistrerPaiement(f.id, { montant: 20, mode: "PLUSIEURS_FOIS", nombreFois: 3 });
    await enregistrerPaiement(f.id, { montant: 10, mode: "CB", nombreFois: 4 });
    const p = await db.paiement.findMany({ orderBy: { datePaiement: "asc" } });
    expect(p.map((x) => x.nombreFois)).toEqual([3, null]); // ignoré hors « plusieurs fois »
  });
});
