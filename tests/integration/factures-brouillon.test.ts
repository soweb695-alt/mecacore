import { inflateSync } from "node:zlib";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { marquerLivre, marquerPrete } from "@/lib/services/bl";
import { creerFactureDepuisBons, creerFactureDepuisDevis, creerFactureManuelle, emettreBrouillon, supprimerBrouillon } from "@/lib/services/factures";
import { pdfFacture } from "@/lib/pdf/facture";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});
const stock = async (id: string) => (await db.piece.findUniqueOrThrow({ where: { id } })).stock;
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

describe("facture enregistrée en brouillon avant émission", () => {
  it("saisie à la main : pas de numéro ni de mouvement de stock ; PDF filigrané ; l'émission numérote et décrémente", async () => {
    const f = await creerFactureManuelle(b.user.id, { clientId: b.client.id, lignes: [ligne(b.p1.id, 2)], brouillon: true });
    expect(f.numero).toBeNull();
    expect((await db.facture.findUniqueOrThrow({ where: { id: f.id } })).statut).toBe("BROUILLON");
    expect(await stock(b.p1.id)).toBe(5);
    const t = textePdf((await pdfFacture(f.id))!.pdf);
    expect(t).toContain("BROUILLON");
    expect(t).toContain("l'émission".replace("é", "é"));

    const e = await emettreBrouillon(f.id, b.user.id);
    expect(e.numero).toMatch(/^FAC-\d{4}-0001$/);
    expect(await stock(b.p1.id)).toBe(3);
    expect(textePdf((await pdfFacture(f.id))!.pdf)).not.toContain("BROUILLON");
  });

  it("depuis un devis : brouillon sans numéro, l'OR n'est pas touché ; à l'émission le stock (déjà sorti au devis) ne bouge pas", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    const { ordre } = await validerDevis(id, creneau(b.meca.id));
    expect(await stock(b.p1.id)).toBe(4);
    const f = await creerFactureDepuisDevis(id, b.user.id, { brouillon: true });
    expect(f.numero).toBeNull();
    expect((await db.ordreReparation.findUniqueOrThrow({ where: { id: ordre!.id } })).statut).toBe("EN_ATTENTE_SIGNATURE");
    expect((await emettreBrouillon(f.id, b.user.id)).numero).toMatch(/^FAC-/);
    expect(await stock(b.p1.id)).toBe(4);
  });

  it("bons de livraison regroupés : émis sans double sortie de stock ; un brouillon supprimé libère les bons", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
      const { bonLivraison } = await validerDevis(id, {});
      await marquerPrete(bonLivraison!.id);
      await marquerLivre(bonLivraison!.id);
      ids.push(bonLivraison!.id);
    }
    expect(await stock(b.p1.id)).toBe(3);
    const f1 = await creerFactureDepuisBons(ids, b.user.id, { brouillon: true });
    expect(await db.bonLivraison.count({ where: { factureId: f1.id } })).toBe(2);
    await supprimerBrouillon(f1.id);
    expect(await db.facture.count()).toBe(0);
    expect(await db.bonLivraison.count({ where: { factureId: null } })).toBe(2);

    const f2 = await creerFactureDepuisBons(ids, b.user.id, { brouillon: true });
    const e = await emettreBrouillon(f2.id, b.user.id);
    expect(e.numero).toMatch(/^FAC-/);
    expect(await stock(b.p1.id)).toBe(3);
  });

  it("une facture émise ne se supprime pas", async () => {
    const f = await creerFactureManuelle(b.user.id, { clientId: b.client.id, lignes: [ligne(b.p1.id, 1)] });
    await expect(supprimerBrouillon(f.id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });
});
