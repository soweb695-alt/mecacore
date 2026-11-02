import { afterEach, describe, expect, it, vi } from "vitest";
import { envoyerEmailBrevo } from "@/lib/integrations/brevo";
import { getFactureProvider } from "@/lib/integrations/facture-electronique";
import { envoyerSmsPartner, normaliserTelephone } from "@/lib/integrations/sms-partner";
import { decoderVin } from "@/lib/integrations/vin";
import { emailRappelRdv, emailRecapImpayes, esc, smsCommandePrete, smsRappelRdv } from "@/lib/messages/templates";
import { genererPdf } from "@/lib/pdf/document";
import { getFichier, putFichier, typeImage } from "@/lib/storage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Brevo et SMS Partner", () => {
  it("passent en simulation sans clé API", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("SMS_PARTNER_API_KEY", "");
    expect(await envoyerEmailBrevo({ to: "a@b.fr", subject: "s", html: "h" })).toMatchObject({ ok: false, simulation: true });
    expect(await envoyerSmsPartner({ to: "0612345678", message: "m" })).toMatchObject({ ok: false, simulation: true });
  });

  it("appellent l'API REST avec la clé lue dans l'environnement", async () => {
    vi.stubEnv("BREVO_API_KEY", "cle-brevo");
    vi.stubEnv("SMS_PARTNER_API_KEY", "cle-sms");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await envoyerEmailBrevo({ to: "a@b.fr", subject: "s", html: "h" })).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.brevo.com/v3/smtp/email");
    expect(fetchMock.mock.calls[0][1].headers["api-key"]).toBe("cle-brevo");
    expect(await envoyerSmsPartner({ to: "06 12 34 56 78", message: "m" })).toEqual({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ phoneNumbers: "33612345678", apiKey: "cle-sms" });
  });

  it("signalent les erreurs sans lever d'exception", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    vi.stubEnv("SMS_PARTNER_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau")));
    expect((await envoyerEmailBrevo({ to: "a@b.fr", subject: "s", html: "h" })).ok).toBe(false);
    expect((await envoyerSmsPartner({ to: "0612345678", message: "m" })).ok).toBe(false);
    expect(await envoyerSmsPartner({ to: "123", message: "m" })).toMatchObject({ ok: false, erreur: "Numéro de téléphone invalide" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    expect((await envoyerEmailBrevo({ to: "a@b.fr", subject: "s", html: "h" })).erreur).toContain("500");
  });

  it("normalise les numéros français", () => {
    expect(normaliserTelephone("06 12 34 56 78")).toBe("33612345678");
    expect(normaliserTelephone("+33 6 12 34 56 78")).toBe("33612345678");
    expect(normaliserTelephone("0033612345678")).toBe("33612345678");
    expect(normaliserTelephone("12345")).toBeNull();
  });
});

describe("décodage VIN", () => {
  it("rend null sans configuration, hors HTTPS, en cas d'erreur ou de réponse incomplète", async () => {
    vi.stubEnv("VIN_DECODER_API_KEY", "");
    expect(await decoderVin("VF3LCBHZ6JS123456")).toBeNull();
    vi.stubEnv("VIN_DECODER_API_KEY", "k");
    vi.stubEnv("VIN_DECODER_API_URL", "http://insecure.example/api");
    expect(await decoderVin("VF3LCBHZ6JS123456")).toBeNull();
    vi.stubEnv("VIN_DECODER_API_URL", "https://vin.example/api");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await decoderVin("VF3LCBHZ6JS123456")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ make: "Peugeot" }) }));
    expect(await decoderVin("VF3LCBHZ6JS123456")).toBeNull();
  });

  it("extrait marque, modèle, année et motorisation", async () => {
    vi.stubEnv("VIN_DECODER_API_KEY", "k");
    vi.stubEnv("VIN_DECODER_API_URL", "https://vin.example/api");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { make: "Peugeot", model: "308", year: "2019", engine: "1.5 BlueHDi" } }) }));
    expect(await decoderVin("VF3LCBHZ6JS123456")).toEqual({ marque: "Peugeot", modele: "308", annee: 2019, motorisation: "1.5 BlueHDi" });
  });
});

describe("facture électronique", () => {
  it("le mock trace le dépôt, un fournisseur non branché lève une erreur explicite", async () => {
    vi.stubEnv("FACTURE_ELECTRONIQUE_PROVIDER", "mock");
    const mock = getFactureProvider();
    const f = { id: "f1", numero: "FAC-1", dateEmission: new Date(), dateEcheance: new Date(), totalHT: 1, totalTVA: 0.2, totalTTC: 1.2, client: { nom: "X", siret: null, tvaNumber: null }, lignes: [] };
    expect((await mock.envoyer(f)).reference).toBe("MOCK-FAC-1");
    expect((await mock.recupererStatut("f1")).statut).toContain("simulation");
    vi.stubEnv("FACTURE_ELECTRONIQUE_PROVIDER", "chorus");
    await expect(getFactureProvider().envoyer(f)).rejects.toThrow(/à brancher/);
  });
});

describe("modèles de messages", () => {
  it("échappent le HTML des données client", () => {
    expect(esc(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
    const mail = emailRappelRdv({ garage: "<b>G</b>", debut: new Date("2026-11-10T08:00:00Z"), vehicule: "<img src=x>", telephone: "0102030405" });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain("<b>G</b>");
  });
  it("formatent SMS et récapitulatif", () => {
    const d = new Date("2026-11-10T13:00:00Z");
    expect(smsRappelRdv({ garage: "G", debut: d, telephone: "01", joursAvant: 1 })).toContain("demain à 14:00");
    expect(smsRappelRdv({ garage: "G", debut: d, telephone: "01", joursAvant: 7 })).toContain("mardi 10 novembre");
    expect(smsCommandePrete({ garage: "G", numero: "BL-1", telephone: "01" })).toContain("BL-1");
    const r = emailRecapImpayes({ garage: "G", lignes: [{ numero: "FAC-1", client: "<X>", reste: 100, joursRetard: 5 }] });
    expect(r.subject).toContain("1 en retard");
    expect(r.html).toContain("&lt;X&gt;");
  });
});

describe("PDF et stockage", () => {
  it("génère un PDF valide, y compris sur plusieurs pages et avec accents", async () => {
    const lignes = Array.from({ length: 60 }, (_, i) => ({ designation: `Ligne ${i} – œuvre « é à ç » ${"très longue désignation ".repeat(4)}`, quantite: 1, prixUnitaireHT: 10, tvaRate: 20, totalHT: 10 }));
    const pdf = await genererPdf({
      titre: "Facture", numero: "FAC-1", dateEmission: new Date(), garage: { nom: "G", adresse: "a", telephone: "t", email: "e", siret: "s", tva: "v" },
      client: { nom: "C" }, lignes, totaux: { totalHT: 600, totalTVA: 120, totalTTC: 720 }, remisePro: 10, paiement: { paye: 100, reste: 620 }, notes: ["note"],
    });
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it("détecte le vrai type d'image et refuse les clés dangereuses", async () => {
    expect(typeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime).toBe("image/png");
    expect(typeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(typeImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))?.ext).toBe("webp");
    expect(typeImage(Buffer.from("<?php echo 1;"))).toBeNull();
    await expect(putFichier("../evasion.png", Buffer.from("x"), "image/png")).rejects.toThrow();
    await expect(getFichier("a//b")).rejects.toThrow();
    await putFichier("tests/essai.bin", Buffer.from("ok"), "application/octet-stream");
    expect((await getFichier("tests/essai.bin"))?.toString()).toBe("ok");
    expect(await getFichier("tests/inexistant.bin")).toBeNull();
  });
});
