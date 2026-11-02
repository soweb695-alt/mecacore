import { inflateSync } from "node:zlib";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { creerDevis, rouvrirDevis, validerDevis } from "@/lib/services/devis";
import { enregistrerFiche, obtenirFiche, renvoyerALAtelier } from "@/lib/services/fiche-controle";
import { annulerFacture, emettreBrouillon, enregistrerPaiement, modifierBrouillon } from "@/lib/services/factures";
import { enregistrerSignature, terminerOrdre } from "@/lib/services/ordres";
import { facturesARelancer, marquerRelancee } from "@/lib/services/relances";
import { enregistrerTarif } from "@/lib/services/tarifs";
import { analyser } from "@/lib/services/analyse";
import { facturesVersPdf, facturesVersXlsx } from "@/lib/export-factures";
import { pdfFacture } from "@/lib/pdf/facture";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
/** Texte des flux PDF (pdf-lib écrit chaque chaîne en hexadécimal dans des flux compressés). */
function textePdf(pdf: Uint8Array): string {
  let out = "";
  for (const m of Buffer.from(pdf).toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const flux = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
      for (const h of flux.matchAll(/<([0-9A-Fa-f]+)>/g)) out += `${Buffer.from(h[1], "hex").toString("latin1")}\n`;
    } catch {
      /* flux non compressé ou binaire : ignoré */
    }
  }
  return out;
}
const stock = async (id: string) => (await db.piece.findUniqueOrThrow({ where: { id } })).stock;
const MO = { type: "MAIN_OEUVRE" as const, designation: "Remplacement plaquettes", quantite: 1.5, prixUnitaireHT: 60, tvaRate: 20 };

/** Forfait « Vidange » : 1 × P2 (filtre) par forfait. */
async function forfaitVidange() {
  return (await enregistrerTarif({ type: "FORFAIT", libelle: "Vidange", description: "Huile + filtre", montantHT: 89, actif: true, pieces: [{ pieceId: b.p2.id, quantite: 1 }] })).id;
}

/** Devis mécanique validé, OR signé, fiche validée et OR terminé : renvoie les ids et la facture brouillon. */
async function orTermine(lignes = [ligne(b.p1.id, 1, 50), MO]) {
  const { id: devisId } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, kilometrage: 80_000, lignes });
  const v = await validerDevis(devisId, creneau(b.meca.id));
  const ordreId = v.ordre!.id;
  await enregistrerSignature(ordreId, PNG);
  const fiche = await obtenirFiche(ordreId);
  await enregistrerFiche(ordreId, { id: b.meca.id, role: "MECANICIEN" }, { points: fiche.points.map((p) => ({ id: p.id, resultat: "OK" })), remarques: "", valider: true });
  const { factureId } = await terminerOrdre(ordreId, 81_250);
  return { devisId, ordreId, factureId };
}

describe("forfaits : description et pièces comprises", () => {
  it("décrémente les pièces du forfait (× quantité) à la validation et les restitue à la réouverture", async () => {
    const tarifId = await forfaitVidange();
    const t = await db.tarif.findUniqueOrThrow({ where: { id: tarifId }, include: { pieces: true } });
    expect(t).toMatchObject({ description: "Huile + filtre", pieces: [{ pieceId: b.p2.id, quantite: 1 }] });

    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [{ type: "FORFAIT", designation: "Vidange", quantite: 2, prixUnitaireHT: 89, tvaRate: 20, tarifId }] });
    const l = await db.ligneDevis.findFirstOrThrow({ where: { devisId: id } });
    expect(l.composition).toEqual([{ pieceId: b.p2.id, reference: "P2", nom: "Filtre", quantite: 1 }]);

    await validerDevis(id, creneau(b.meca.id));
    expect(await stock(b.p2.id)).toBe(3); // 5 − 2 × 1
    await rouvrirDevis(id);
    expect(await stock(b.p2.id)).toBe(5);
  });

  it("refuse un forfait si ses pièces ne sont pas en stock, et une quantité non entière", async () => {
    const tarifId = await forfaitVidange();
    const forfait = (quantite: number) => ({ type: "FORFAIT" as const, designation: "Vidange", quantite, prixUnitaireHT: 89, tvaRate: 20, tarifId });
    await expect(creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [forfait(6)] })).rejects.toMatchObject({ code: "STOCK_INSUFFISANT" });
    await expect(creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [forfait(1.5)] })).rejects.toMatchObject({ code: "QUANTITE_INVALIDE" });
  });

  it("une pièce du forfait au seuil d'alerte déclenche un bon de commande « En attente »", async () => {
    const tarifId = await forfaitVidange();
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [{ type: "FORFAIT", designation: "Vidange", quantite: 3, prixUnitaireHT: 89, tvaRate: 20, tarifId }] });
    const r = await validerDevis(id, creneau(b.meca.id));
    expect(await stock(b.p2.id)).toBe(2); // = seuil d'alerte
    expect(r.reappro).toHaveLength(1);
    const bc = await db.bonCommande.findFirstOrThrow({ include: { lignes: true } });
    expect(bc).toMatchObject({ statut: "EN_ATTENTE", automatique: true, lignes: [{ pieceId: b.p2.id, quantite: 2 }] });
  });
});

describe("OR terminé → facture brouillon → émission", () => {
  it("prépare un brouillon sans numéro, hors chiffre d'affaires, puis l'émet avec un numéro", async () => {
    const { ordreId, factureId } = await orTermine();
    const f = await db.facture.findUniqueOrThrow({ where: { id: factureId }, include: { lignes: true } });
    expect(f).toMatchObject({ statut: "BROUILLON", numero: null, kilometrage: 81_250 });
    expect(f.lignes).toHaveLength(2);
    expect((await analyser("mois")).nbFactures).toBe(0);
    await expect(enregistrerPaiement(factureId, { montant: 10, mode: "CB" })).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
    await expect(annulerFacture(factureId)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });

    const r = await emettreBrouillon(factureId, b.user.id);
    expect(r.numero).toMatch(/^FAC-\d{4}-0001$/);
    expect(await db.facture.findUniqueOrThrow({ where: { id: factureId } })).toMatchObject({ statut: "EMISE", numero: r.numero, userId: b.user.id });
    expect((await db.ordreReparation.findUniqueOrThrow({ where: { id: ordreId } })).statut).toBe("FACTURE");
    expect(await db.ficheControle.findUniqueOrThrow({ where: { ordreId } })).toMatchObject({ statut: "TRAITEE", traiteeParId: b.user.id });
    expect((await analyser("mois")).nbFactures).toBe(1);
    await expect(emettreBrouillon(factureId, b.user.id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("ajuste le stock de l'écart avec le devis à l'émission (pièce ajoutée, pièce retirée)", async () => {
    const { factureId } = await orTermine([ligne(b.p1.id, 2, 50), MO]);
    expect(await stock(b.p1.id)).toBe(3);
    const lignes = (await db.ligneFacture.findMany({ where: { factureId }, orderBy: { position: "asc" } })).map((l) => ({
      id: l.id, type: l.type, designation: l.designation, quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), tvaRate: Number(l.tvaRate), pieceId: l.pieceId,
    }));
    lignes[0].quantite = 1; // une plaquette rendue
    await modifierBrouillon(factureId, { lignes: [...lignes, ligne(b.p2.id, 2, 10)] });
    expect(await stock(b.p1.id)).toBe(3); // rien ne bouge avant l'émission
    expect(Number((await db.facture.findUniqueOrThrow({ where: { id: factureId } })).totalHT)).toBe(50 + 90 + 20);

    await emettreBrouillon(factureId, b.user.id);
    expect(await stock(b.p1.id)).toBe(4);
    expect(await stock(b.p2.id)).toBe(3);
  });

  it("renvoyer la fiche à l'atelier remet l'OR en cours et supprime le brouillon", async () => {
    const { ordreId, factureId } = await orTermine();
    await renvoyerALAtelier(ordreId);
    expect((await db.ordreReparation.findUniqueOrThrow({ where: { id: ordreId } })).statut).toBe("EN_COURS");
    expect(await db.facture.count({ where: { id: factureId } })).toBe(0);
  });

  it("le PDF porte immatriculation, kilométrage, référence des pièces et temps × taux horaire", async () => {
    const { factureId } = await orTermine([{ ...ligne(b.p1.id, 1, 50), designation: "Plaquettes avant" }, MO]);
    const r = await pdfFacture(factureId);
    const doc = await PDFDocument.load(r!.pdf);
    expect(doc.getTitle()).toBe("Facture (brouillon) non attribué");
    const texte = textePdf(r!.pdf);
    for (const m of ["Immatriculation : AB-123-CD", "Kilométrage : 81 250 km", "Pièce réf. P1", "temps facturé 1,5 h au taux horaire de 60,00 EUR HT", "1,5 h", "Document de travail"]) {
      expect(texte, m).toContain(m);
    }
  });
});

describe("relances et export", () => {
  async function factureImpayee() {
    const { factureId } = await orTermine();
    await emettreBrouillon(factureId, b.user.id);
    await db.facture.update({ where: { id: factureId }, data: { dateEcheance: new Date(Date.now() - 10 * 864e5) } });
    return factureId;
  }

  it("liste les impayées et compte les relances datées", async () => {
    const id = await factureImpayee();
    let liste = await facturesARelancer();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ id, nombreRelances: 0, derniereRelance: null });
    expect((await marquerRelancee(id, b.user.id)).nombreRelances).toBe(1);
    expect((await marquerRelancee(id, b.user.id)).nombreRelances).toBe(2);
    liste = await facturesARelancer();
    expect(liste[0].nombreRelances).toBe(2);
    expect(liste[0].derniereRelance).toBeInstanceOf(Date);
    expect(await db.relanceFacture.count({ where: { factureId: id, userId: b.user.id } })).toBe(2);
  });

  it("refuse de relancer une facture qui n'est pas impayée", async () => {
    const { factureId } = await orTermine();
    await expect(marquerRelancee(factureId, b.user.id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });

  it("exporte la sélection en Excel (factures + lignes) et en PDF groupé", async () => {
    const id = await factureImpayee();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await facturesVersXlsx([id])) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Factures")!;
    expect(ws.rowCount).toBe(2);
    expect(ws.getRow(2).getCell(1).value).toMatch(/^FAC-/);
    expect(ws.getRow(2).getCell(7).value).toBe("AB-123-CD");
    expect(wb.getWorksheet("Lignes")!.rowCount).toBe(3);

    const pdf = await PDFDocument.load(await facturesVersPdf([id]));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
