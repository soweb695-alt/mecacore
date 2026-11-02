import "server-only";

export interface EntrepriseInfo {
  siren: string;
  siret: string;
  nom: string;
  adresse: string;
  tvaNumber: string;
}

const API = "https://recherche-entreprises.api.gouv.fr/search";

/** N° de TVA intracommunautaire français déduit du SIREN : FR + clé (12 + 3 × (SIREN mod 97)) mod 97 + SIREN. */
export function tvaDepuisSiren(siren: string): string {
  const cle = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${String(cle).padStart(2, "0")}${siren}`;
}

interface ResultatApi {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  tva?: string[] | string | null;
  etat_administratif?: string;
  siege?: { siret?: string; adresse?: string };
}

/** Recherche d'une entreprise par nom, SIREN ou SIRET (API publique « Recherche d'entreprises », sans clé). */
export async function rechercherEntreprises(q: string): Promise<EntrepriseInfo[]> {
  const terme = q.trim();
  if (terme.length < 3) return [];
  const url = new URL(API);
  url.searchParams.set("q", terme.replace(/\s+/g, " "));
  url.searchParams.set("per_page", "6");
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: ResultatApi[] };
    return (json.results ?? [])
      .filter((r) => r.siren && /^\d{9}$/.test(r.siren) && r.etat_administratif !== "C")
      .map((r) => {
        const tva = Array.isArray(r.tva) ? r.tva[0] : r.tva;
        return {
          siren: r.siren!,
          siret: r.siege?.siret ?? "",
          nom: r.nom_complet || r.nom_raison_sociale || "",
          adresse: r.siege?.adresse ?? "",
          tvaNumber: tva || tvaDepuisSiren(r.siren!),
        };
      });
  } catch {
    return [];
  }
}
