import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

import { db } from "@/lib/db";
import { GET as pdfGet } from "@/app/api/ordres-reparation/[id]/pdf/route";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { enregistrerSignature } from "@/lib/services/ordres";
import { MENTION_ACCORD_OR_DEFAUT } from "@/lib/validators/parametres";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MO = { type: "MAIN_OEUVRE" as const, designation: "Remplacement plaquettes", quantite: 1, prixUnitaireHT: 60, tvaRate: 20 };

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

async function ordre() {
  const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1, 50), MO] });
  return (await validerDevis(id, creneau(b.meca.id))).ordre!.id;
}
const telecharger = async (id: string, prix: boolean) => {
  const r = await pdfGet(new NextRequest(`http://localhost/api/ordres-reparation/${id}/pdf${prix ? "?prix=1" : ""}`, { headers: { host: "localhost" } }), { params: Promise.resolve({ id }) });
  return { status: r.status, pdf: new Uint8Array(await r.arrayBuffer()) };
};

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  courant = { id: b.user.id, role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" };
});

describe("PDF de l'ordre de réparation", () => {
  it("avec prix : travaux, totaux et bon pour accord signé (image de la signature du client)", async () => {
    const id = await ordre();
    await enregistrerSignature(id, PNG);
    const { status, pdf } = await telecharger(id, true);
    expect(status).toBe(200);
    const t = textePdf(pdf);
    expect(t).toContain("Ordre de r");
    expect(t).toContain("Remplacement plaquettes");
    expect(t).toContain("Total TTC");
    expect(t).toContain("BON POUR ACCORD".split("").join("\n"));
    expect(t).toContain(MENTION_ACCORD_OR_DEFAUT.slice(0, 40));
    expect(t).not.toContain("Non sign");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPages()[0].node.Resources()?.toString()).toContain("XObject");
  });

  it("sans prix : aucun montant ; non signé : cadre à signer ; mention personnalisée", async () => {
    await db.parametreGarage.update({ where: { id: 1 }, data: { mentionAccordOR: "Bon pour accord. Gardiennage facturé après 48 h." } });
    const id = await ordre();
    const t = textePdf((await telecharger(id, false)).pdf);
    expect(t).toContain("Remplacement plaquettes");
    expect(t).not.toContain("Total TTC");
    expect(t).not.toMatch(/\d+,\d{2}\s?(€|EUR)/);
    expect(t).toContain("Main d'oeuvre : 1 h");
    expect(t).toContain("Gardiennage factur");
    expect(t).toContain("Non sign");
  });

  it("l'atelier n'obtient jamais les prix, et seulement pour ses propres ordres", async () => {
    const id = await ordre();
    courant = { id: b.meca.id, role: "MECANICIEN", email: "m@a.fr", firstName: "M", lastName: "M" };
    const t = textePdf((await telecharger(id, true)).pdf);
    expect(t).not.toContain("Total TTC");
    const autre = await db.user.create({ data: { email: "m2@test.fr", passwordHash: "x", firstName: "A", lastName: "B", role: "MECANICIEN" } });
    courant = { id: autre.id, role: "MECANICIEN", email: "m2@test.fr", firstName: "A", lastName: "B" };
    expect((await telecharger(id, false)).status).toBe(403);
  });
});
