import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { creerFactureDepuisDevis, enregistrerPaiement, envoyerRapportImpayes, rafraichirStatuts } from "@/lib/services/factures";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

async function devisValide() {
  const { id } = await creerDevis(b.user.id, {
    type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id,
    lignes: [ligne(b.p1.id, 2, 50), { type: "MAIN_OEUVRE", designation: "MO", quantite: 1, prixUnitaireHT: 100, tvaRate: 20 }],
  });
  await validerDevis(id, creneau(b.meca.id));
  return id;
}

describe("facturation", () => {
  it("crée la facture depuis un devis validé (lignes, totaux, échéance, numéro, PA)", async () => {
    const devisId = await devisValide();
    const { id, numero } = await creerFactureDepuisDevis(devisId);
    expect(numero).toBe(`FAC-${new Date().getFullYear()}-0001`);
    const f = await db.facture.findUniqueOrThrow({ where: { id }, include: { lignes: true } });
    expect(f.lignes).toHaveLength(2);
    expect(Number(f.totalTTC)).toBe(240);
    expect(f.statut).toBe("EMISE");
    expect(f.statutPA).toContain("simulation");
    const jours = Math.round((f.dateEcheance.getTime() - f.dateEmission.getTime()) / 864e5);
    expect(jours).toBe(30);
    // prix d'achat conservé pour le calcul de marge
    expect(f.lignes.find((l) => l.type === "PIECE")?.prixAchatHT?.toString()).toBe("30");
  });

  it("refuse de facturer deux fois ou un devis non validé", async () => {
    const devisId = await devisValide();
    await creerFactureDepuisDevis(devisId);
    await expect(creerFactureDepuisDevis(devisId)).rejects.toMatchObject({ code: "DEJA_FACTURE" });
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p2.id, 1, 10)] });
    await expect(creerFactureDepuisDevis(id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("suit les paiements : partiel puis soldé, et refuse le trop-perçu", async () => {
    const { id } = await creerFactureDepuisDevis(await devisValide());
    const p1 = await enregistrerPaiement(id, { montant: 100, mode: "CB" });
    expect(p1).toMatchObject({ statut: "PARTIELLEMENT_PAYEE", montantPaye: 100, reste: 140 });
    await expect(enregistrerPaiement(id, { montant: 150, mode: "CHEQUE" })).rejects.toMatchObject({ code: "MONTANT_INVALIDE" });
    const p2 = await enregistrerPaiement(id, { montant: 140, mode: "VIREMENT", reference: "VIR-1" });
    expect(p2).toMatchObject({ statut: "PAYEE", reste: 0 });
    await expect(enregistrerPaiement(id, { montant: 1, mode: "CB" })).rejects.toMatchObject({ code: "DEJA_PAYEE" });
  });

  it("n'enregistre qu'un paiement pour deux règlements concurrents du solde", async () => {
    const { id } = await creerFactureDepuisDevis(await devisValide());
    const res = await Promise.allSettled([enregistrerPaiement(id, { montant: 240, mode: "CB" }), enregistrerPaiement(id, { montant: 240, mode: "CB" })]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.paiement.count()).toBe(1);
  });

  it("passe en IMPAYEE après l'échéance et envoie le rapport une seule fois", async () => {
    const { id } = await creerFactureDepuisDevis(await devisValide());
    await db.facture.update({ where: { id }, data: { dateEcheance: new Date(Date.now() - 5 * 864e5) } });
    expect(await rafraichirStatuts()).toBe(1);
    expect((await db.facture.findUniqueOrThrow({ where: { id } })).statut).toBe("IMPAYEE");

    await db.user.create({ data: { email: "admin@test.fr", passwordHash: "x", firstName: "A", lastName: "B", role: "ADMIN" } });
    const r1 = await envoyerRapportImpayes();
    const r2 = await envoyerRapportImpayes();
    expect(r1).toMatchObject({ factures: 1, envoyes: 2 }); // admin + secrétariat
    expect(r2.envoyes).toBe(0); // idempotent : pas de double envoi
    expect(await db.messageLog.count({ where: { template: "recap_impayes" } })).toBe(2);
  });
});
