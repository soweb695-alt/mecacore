import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth";
import { lireCorps } from "@/lib/body";
import { clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { creerDevis } from "@/lib/services/devis";
import { lireDevis } from "@/lib/services/devis";
import { pieceVue, pieceData } from "@/lib/services/pieces";
import { ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

type Authorize = (c: Record<string, string>, req: { headers: Record<string, string> }) => Promise<unknown>;
const authorize = (authOptions.providers[0] as unknown as { options: { authorize: Authorize } }).options.authorize;
const req = (ip: string) => ({ headers: { "x-forwarded-for": ip } });

describe("connexion", () => {
  beforeEach(async () => {
    await db.user.update({ where: { id: b.user.id }, data: { passwordHash: await bcrypt.hash("Mot-de-passe-solide-1", 12) } });
  });

  it("accepte les bons identifiants et refuse les mauvais", async () => {
    expect(await authorize({ email: "sec@test.fr", password: "Mot-de-passe-solide-1" }, req("1.1.1.1"))).toMatchObject({ id: b.user.id, role: "SECRETARIAT" });
    expect(await authorize({ email: "sec@test.fr", password: "faux" }, req("1.1.1.2"))).toBeNull();
    expect(await authorize({ email: "inconnu@test.fr", password: "x" }, req("1.1.1.3"))).toBeNull();
  });

  it("refuse un compte désactivé", async () => {
    await db.user.update({ where: { id: b.user.id }, data: { isActive: false } });
    expect(await authorize({ email: "sec@test.fr", password: "Mot-de-passe-solide-1" }, req("1.1.1.4"))).toBeNull();
  });

  it("bloque après 5 échecs depuis la même IP (même avec le bon mot de passe)", async () => {
    for (let i = 0; i < 5; i++) expect(await authorize({ email: "sec@test.fr", password: "faux" }, req("9.9.9.9"))).toBeNull();
    await expect(authorize({ email: "sec@test.fr", password: "Mot-de-passe-solide-1" }, req("9.9.9.9"))).rejects.toThrow("TROP_DE_TENTATIVES");
    // Une autre IP n'est pas affectée.
    expect(await authorize({ email: "sec@test.fr", password: "Mot-de-passe-solide-1" }, req("8.8.8.8"))).not.toBeNull();
  });

  it("ne se laisse pas contourner en changeant X-Forwarded-For : seule l'IP ajoutée par le proxy compte", async () => {
    // Le client écrit la partie gauche de l'en-tête ; le proxy ajoute l'IP réelle à droite.
    for (let i = 0; i < 5; i++) expect(await authorize({ email: "sec@test.fr", password: "faux" }, req(`10.0.0.${i}, 9.9.9.9`))).toBeNull();
    await expect(authorize({ email: "sec@test.fr", password: "Mot-de-passe-solide-1" }, req("10.0.0.99, 9.9.9.9"))).rejects.toThrow("TROP_DE_TENTATIVES");
  });

  it("bloque un compte visé depuis de nombreuses IP (10 échecs)", async () => {
    for (let i = 0; i < 10; i++) expect(await authorize({ email: "sec@test.fr", password: "faux" }, req(`7.7.7.${i}`))).toBeNull();
    await expect(authorize({ email: "sec@test.fr", password: "Mot-de-passe-solide-1" }, req("7.7.7.200"))).rejects.toThrow("TROP_DE_TENTATIVES");
    // Les autres comptes ne sont pas touchés.
    await db.user.update({ where: { id: b.meca.id }, data: { passwordHash: await bcrypt.hash("Mot-de-passe-solide-2", 12) } });
    expect(await authorize({ email: "meca@test.fr", password: "Mot-de-passe-solide-2" }, req("7.7.7.201"))).not.toBeNull();
  });

  it("stocke des mots de passe hachés en bcrypt coût 12", async () => {
    const u = await db.user.findUniqueOrThrow({ where: { id: b.user.id } });
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });
});

describe("confidentialité des prix d'achat et des marges", () => {
  it("prix d'achat : admin et Magasin ; marge : admin seul ; Atelier : rien", async () => {
    const piece = await db.piece.findUniqueOrThrow({ where: { id: b.p1.id } });
    const admin = pieceVue(piece, { id: "a", role: "ADMIN" });
    expect(admin.prixAchatHT).toBe(30);
    expect(admin.margePct).toBe(40);

    const magasin = pieceVue(piece, { id: "s", role: "SECRETARIAT" });
    expect(magasin.prixAchatHT).toBe(30);
    expect(JSON.stringify(magasin)).not.toMatch(/marge/i);

    const atelier = pieceVue(piece, { id: "m", role: "MECANICIEN" });
    expect(JSON.stringify(atelier)).not.toMatch(/prixAchat|marge/i);
  });

  it("le prix d'achat n'est modifiable que par l'admin et le Magasin", () => {
    const input = { reference: "P1", nom: "Plaquettes", prixAchatHT: 1, prixVenteHT: 60, stock: 5, seuilAlerte: 2, referencesCroisees: [] as string[] };
    expect(pieceData(input, { id: "a", role: "ADMIN" }, false).prixAchatHT).toBe(1);
    expect(pieceData(input, { id: "s", role: "SECRETARIAT" }, false).prixAchatHT).toBe(1);
    expect("prixAchatHT" in pieceData(input, { id: "m", role: "MECANICIEN" }, false)).toBe(false);
  });

  it("n'expose les marges d'un devis qu'à l'administrateur", async () => {
    const { id } = await creerDevis(b.user.id, { type: "PIECE", clientId: b.client.id, lignes: [ligne(b.p1.id, 1, 50)] });
    const admin = await lireDevis(id, { id: "a", role: "ADMIN" });
    const sec = await lireDevis(id, { id: "s", role: "SECRETARIAT" });
    expect(admin?.lignes[0]).toMatchObject({ prixAchatHT: 30, margeHT: 20 });
    expect(JSON.stringify(sec)).not.toMatch(/prixAchat|marge/i);
  });
});

describe("IP du client derrière les proxys", () => {
  it("prend l'entrée ajoutée par le dernier proxy de confiance", () => {
    expect(clientIp({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }, 1)).toBe("1.2.3.4");
    expect(clientIp({ "x-forwarded-for": "6.6.6.6, 1.2.3.4, 10.0.0.1" }, 2)).toBe("1.2.3.4");
    expect(clientIp({ "x-forwarded-for": "6.6.6.6" }, 0)).toBe("inconnue");
    expect(clientIp({ "x-forwarded-for": "1.2.3.4" }, 3)).toBe("inconnue");
  });
});

describe("taille des requêtes", () => {
  const flux = (taille: number) =>
    new Request("http://localhost/api/test", {
      method: "POST",
      body: new ReadableStream({
        start(c) {
          for (let envoye = 0; envoye < taille; envoye += 64_000) c.enqueue(new Uint8Array(Math.min(64_000, taille - envoye)));
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);

  it("coupe un envoi sans Content-Length (chunked) dès que la limite est dépassée", async () => {
    await expect(lireCorps(flux(2_000_000), 1_000_000)).rejects.toMatchObject({ status: 413, code: "TROP_GRAND" });
    expect((await lireCorps(flux(500_000), 1_000_000)).byteLength).toBe(500_000);
  });
});
