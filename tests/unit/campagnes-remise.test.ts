import { afterEach, describe, expect, it, vi } from "vitest";
import { rendreCampagneHtml } from "@/lib/campagne-contenu";
import { lienDesinscription, signerDesinscription, verifierDesinscription } from "@/lib/desinscription";
import { navFor } from "@/lib/permissions";
import { montantRemise, tauxRemiseLigne } from "@/lib/remise";
import { campagneSchema } from "@/lib/validators/campagne";

afterEach(() => vi.unstubAllEnvs());

describe("contenu d'une campagne", () => {
  it("échappe tout HTML saisi, remplace les variables et ajoute le lien de désinscription", () => {
    const html = rendreCampagneHtml('Bonjour {prenom} {nom},\n\n<script>alert(1)</script> chez {garage} & fils', { prenom: "Sophie", nom: "<b>Leroy</b>", garage: "Garage Martin" }, "https://app.test/desinscription?c=1&s=abc", "1 rue X");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Leroy</b>");
    expect(html).toContain("Bonjour Sophie &lt;b&gt;Leroy&lt;/b&gt;,");
    expect(html).toContain("&amp; fils");
    expect(html).toContain('href="https://app.test/desinscription?c=1&amp;s=abc"');
    expect(html).toContain("Se désinscrire");
    expect(html.match(/<p /g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("valide les champs de la campagne", () => {
    const ok = { nom: "Promo", audience: "PRO", sujet: "Offre", contenu: "Un message assez long." };
    expect(campagneSchema.safeParse(ok).success).toBe(true);
    expect(campagneSchema.safeParse({ ...ok, audience: "AUTRE" }).success).toBe(false);
    expect(campagneSchema.safeParse({ ...ok, contenu: "court" }).success).toBe(false);
  });
});

describe("lien de désinscription signé", () => {
  it("n'est valable que pour le client signé et ne peut pas être falsifié", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "secret-de-test-secret-de-test-123456");
    const s = signerDesinscription("client-1");
    expect(verifierDesinscription("client-1", s)).toBe(true);
    expect(verifierDesinscription("client-2", s)).toBe(false);
    expect(verifierDesinscription("client-1", s.replace(/.$/, s.endsWith("0") ? "1" : "0"))).toBe(false);
    expect(verifierDesinscription("client-1", "")).toBe(false);
    expect(verifierDesinscription("client-1", "zz")).toBe(false);
    vi.stubEnv("NEXTAUTH_SECRET", "autre-secret-autre-secret-autre-1234");
    expect(verifierDesinscription("client-1", s)).toBe(false);
  });
  it("construit un lien absolu", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "secret-de-test-secret-de-test-123456");
    vi.stubEnv("APP_URL", "https://garage.example/");
    expect(lienDesinscription("c1")).toMatch(/^https:\/\/garage\.example\/desinscription\?c=c1&s=[0-9a-f]{32}$/);
  });
});

describe("accès à l'onglet Campagnes", () => {
  it("visible pour l'Admin et le Magasin, jamais pour l'Atelier", () => {
    const has = (role: "ADMIN" | "SECRETARIAT" | "MECANICIEN") => navFor({ id: "x", role }).some((i) => i.href === "/campagnes");
    expect([has("ADMIN"), has("SECRETARIAT"), has("MECANICIEN")]).toEqual([true, true, false]);
  });
});

describe("remise professionnelle", () => {
  it("calcule le montant et le taux de remise des lignes pièces", () => {
    expect(montantRemise([{ quantite: 2, prixUnitaireHT: 45, prixCatalogueHT: 50 }, { quantite: 1, prixUnitaireHT: 65, prixCatalogueHT: null }])).toBe(10);
    expect(tauxRemiseLigne({ prixUnitaireHT: 45, prixCatalogueHT: 50 })).toBe(10);
    expect(tauxRemiseLigne({ prixUnitaireHT: 50, prixCatalogueHT: 50 })).toBe(0);
    expect(tauxRemiseLigne({ prixUnitaireHT: 50, prixCatalogueHT: null })).toBe(0);
  });
});
