import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { appliquerRetention } from "@/lib/services/retention";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { creerFactureDepuisDevis } from "@/lib/services/factures";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

const ilYaAns = (n: number) => new Date(Date.now() - n * 366 * 864e5);

describe("RGPD", () => {
  it("anonymise un client inactif depuis plus de 5 ans mais pas un client récent", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { createdAt: new Date() } });
    const vieux = await db.client.create({ data: { type: "PARTICULIER", firstName: "Ancien", lastName: "Client", email: "a@b.fr", phone: "0102030405", createdAt: ilYaAns(6) } });
    const r = await appliquerRetention();
    expect(r.clientsAnonymises).toBe(1);
    const apres = await db.client.findUniqueOrThrow({ where: { id: vieux.id } });
    expect(apres).toMatchObject({ email: null, phone: null, firstName: "Anonyme", isActive: false });
    expect(apres.anonymiseLe).not.toBeNull();
    expect((await db.client.findUniqueOrThrow({ where: { id: b.client.id } })).anonymiseLe).toBeNull();
  });

  it("supprime les messages de plus de 3 ans uniquement", async () => {
    await db.messageLog.create({ data: { cle: "a", canal: "SMS", template: "t", statut: "ENVOYE", envoyeLe: ilYaAns(4) } });
    await db.messageLog.create({ data: { cle: "b", canal: "SMS", template: "t", statut: "ENVOYE", envoyeLe: new Date() } });
    expect((await appliquerRetention()).messagesSupprimes).toBe(1);
    expect(await db.messageLog.count()).toBe(1);
  });

  it("conserve les factures d'un client anonymisé (obligation de 10 ans)", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1, 50)] });
    await validerDevis(id, creneau(b.meca.id));
    const f = await creerFactureDepuisDevis(id);
    // Équivalent de DELETE /api/clients/:id/anonymiser
    await db.client.update({ where: { id: b.client.id }, data: { firstName: "Anonyme", lastName: "X", email: null, phone: null, address: null, isActive: false, anonymiseLe: new Date() } });
    const facture = await db.facture.findUniqueOrThrow({ where: { id: f.id }, include: { client: true } });
    expect(facture.numero).toBe(f.numero);
    expect(facture.client.email).toBeNull();
    expect(Number(facture.totalTTC)).toBeGreaterThan(0);
  });
});
