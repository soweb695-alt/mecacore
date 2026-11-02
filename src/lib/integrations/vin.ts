import "server-only";

export interface VinInfo {
  marque: string;
  modele: string;
  annee: number | null;
  motorisation: string | null;
}

const TIMEOUT_MS = 3000;

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null;
}

/**
 * Appel générique d'un décodeur de véhicule (VIN ou plaque) : `GET <base>?<param>=<valeur>` avec la clé en Bearer.
 * Renvoie null en cas d'indisponibilité (non configuré, hors HTTPS, délai de 3 s dépassé, réponse inattendue) :
 * l'interface bascule alors en saisie manuelle.
 */
export async function decoderVehicule(opts: { baseUrl?: string; apiKey?: string; param: string; valeur: string }): Promise<VinInfo | null> {
  if (!opts.apiKey || !opts.baseUrl) return null;
  let url: URL;
  try {
    url = new URL(opts.baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.searchParams.set(opts.param, opts.valeur);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const src = (typeof json.data === "object" && json.data ? json.data : json) as Record<string, unknown>;
    const marque = texte(src.marque ?? src.make);
    const modele = texte(src.modele ?? src.model);
    if (!marque || !modele) return null;
    const annee = Number(src.annee ?? src.year);
    return {
      marque,
      modele,
      annee: Number.isInteger(annee) && annee > 1900 ? annee : null,
      motorisation: texte(src.motorisation ?? src.engine),
    };
  } catch {
    return null;
  }
}

/** Décodage VIN (VinDecoderVehicle) : VIN_DECODER_API_URL et VIN_DECODER_API_KEY. */
export async function decoderVin(vin: string): Promise<VinInfo | null> {
  return decoderVehicule({ baseUrl: process.env.VIN_DECODER_API_URL, apiKey: process.env.VIN_DECODER_API_KEY, param: "vin", valeur: vin });
}

/**
 * Décodage de plaque d'immatriculation : PLAQUE_DECODER_API_URL et PLAQUE_DECODER_API_KEY.
 * Aucun fournisseur n'est branché pour l'instant : sans configuration, la saisie reste manuelle.
 */
export async function decoderPlaque(plaque: string): Promise<VinInfo | null> {
  return decoderVehicule({ baseUrl: process.env.PLAQUE_DECODER_API_URL, apiKey: process.env.PLAQUE_DECODER_API_KEY, param: "plaque", valeur: plaque });
}

export function plaqueConfiguree(): boolean {
  return Boolean(process.env.PLAQUE_DECODER_API_URL && process.env.PLAQUE_DECODER_API_KEY);
}
