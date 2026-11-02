import { afterEach, describe, expect, it, vi } from "vitest";
import { rechercherEntreprises, tvaDepuisSiren } from "@/lib/integrations/entreprise";
import { decoderPlaque, plaqueConfiguree } from "@/lib/integrations/vin";
import { canSeeMargins, canSeePurchasePrice } from "@/lib/permissions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("décodage de plaque", () => {
  it("n'appelle rien tant qu'aucun fournisseur n'est branché (saisie manuelle)", async () => {
    vi.stubEnv("PLAQUE_DECODER_API_URL", "");
    vi.stubEnv("PLAQUE_DECODER_API_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(plaqueConfiguree()).toBe(false);
    expect(await decoderPlaque("AB-123-CD")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("interroge le fournisseur configuré avec le paramètre « plaque »", async () => {
    vi.stubEnv("PLAQUE_DECODER_API_URL", "https://plaque.example/api");
    vi.stubEnv("PLAQUE_DECODER_API_KEY", "cle");
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ marque: "Peugeot", modele: "308", annee: 2019 }) });
    vi.stubGlobal("fetch", spy);
    expect(plaqueConfiguree()).toBe(true);
    expect(await decoderPlaque("AB-123-CD")).toMatchObject({ marque: "Peugeot", modele: "308", annee: 2019 });
    expect(String(spy.mock.calls[0][0])).toBe("https://plaque.example/api?plaque=AB-123-CD");
  });
});

describe("recherche d'entreprise (SIRET / nom)", () => {
  it("calcule le n° de TVA français depuis le SIREN", () => {
    expect(tvaDepuisSiren("424761419")).toBe("FR22424761419"); // OVH
  });

  it("extrait raison sociale, SIRET, adresse et TVA, et ignore les entreprises fermées", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { siren: "424761419", nom_complet: "OVH (OVHCLOUD)", tva: ["FR22424761419"], etat_administratif: "A", siege: { siret: "42476141900045", adresse: "2 RUE KELLERMANN 59100 ROUBAIX" } },
            { siren: "111111111", nom_complet: "FERMEE", etat_administratif: "C", siege: { siret: "11111111100011", adresse: "X" } },
            { siren: "222222222", nom_complet: "SANS TVA", etat_administratif: "A", siege: { siret: "22222222200022", adresse: "Y" } },
          ],
        }),
      }),
    );
    const r = await rechercherEntreprises("ovh");
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ siren: "424761419", siret: "42476141900045", nom: "OVH (OVHCLOUD)", adresse: "2 RUE KELLERMANN 59100 ROUBAIX", tvaNumber: "FR22424761419" });
    expect(r[1].tvaNumber).toBe(tvaDepuisSiren("222222222"));
  });

  it("rend une liste vide en cas d'erreur réseau ou de saisie trop courte", async () => {
    const spy = vi.fn().mockRejectedValue(new Error("réseau"));
    vi.stubGlobal("fetch", spy);
    expect(await rechercherEntreprises("ovh")).toEqual([]);
    expect(await rechercherEntreprises("ab")).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("droits sur les prix d'achat et les marges", () => {
  it("prix d'achat : admin et Magasin ; marges : admin ; Atelier : aucun", () => {
    const u = (role: "ADMIN" | "SECRETARIAT" | "MECANICIEN") => ({ id: "x", role });
    expect([canSeePurchasePrice(u("ADMIN")), canSeePurchasePrice(u("SECRETARIAT")), canSeePurchasePrice(u("MECANICIEN"))]).toEqual([true, true, false]);
    expect([canSeeMargins(u("ADMIN")), canSeeMargins(u("SECRETARIAT")), canSeeMargins(u("MECANICIEN"))]).toEqual([true, false, false]);
  });
});
