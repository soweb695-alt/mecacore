// Lecture et validation d'un fichier d'import de clients (export Pennylane ou fichier simple). Module sans accès base.
import { z } from "zod";

export const COLONNES_IMPORT_CLIENTS = [
  { cle: "refExterne", titre: "Identifiant Client", aide: "Identifiant dans le logiciel d'origine (Pennylane). Un réimport met à jour la même fiche." },
  { cle: "type", titre: "Type de Client", aide: "« Particulier » ou « Entreprise » (déduit de la dénomination si absent)." },
  { cle: "denomination", titre: "Dénomination", aide: "Raison sociale d'une entreprise, ou nom complet d'un particulier." },
  { cle: "prenom", titre: "Prénom", aide: "" },
  { cle: "nom", titre: "Nom", aide: "" },
  { cle: "siren", titre: "Siren / SIRET", aide: "9 ou 14 chiffres." },
  { cle: "tva", titre: "Numéro de TVA", aide: "Ex. FR12345678901." },
  { cle: "email", titre: "E-mail", aide: "Plusieurs adresses : la première est gardée." },
  { cle: "telephone", titre: "Téléphone", aide: "" },
  { cle: "adresse", titre: "Adresse", aide: "" },
  { cle: "codePostal", titre: "Code Postal", aide: "" },
  { cle: "ville", titre: "Ville", aide: "" },
  { cle: "pays", titre: "Pays", aide: "Code pays (FR par défaut)." },
  { cle: "conditions", titre: "Conditions de Paiement", aide: "« Payable dès réception » = 0 jour, « sous 30 jours » = 30." },
] as const;

export type CleColonneClient = (typeof COLONNES_IMPORT_CLIENTS)[number]["cle"];

export const MAX_LIGNES_IMPORT_CLIENTS = 5000;

export interface ClientImport {
  refExterne?: string;
  type: "PARTICULIER" | "PRO";
  firstName?: string;
  lastName?: string;
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Code postal (rapprochement avec les clients déjà saisis). */
  codePostal?: string;
  paymentTerms?: number;
}

export interface LigneClientAnalysee {
  ligne: number;
  libelle: string;
  valeurs?: ClientImport;
  erreurs: string[];
  /** Champs ignorés (format invalide) : la ligne est importée sans eux. */
  avertissements: string[];
}

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Titres de colonnes reconnus (export Pennylane et variantes courantes). */
const SYNONYMES: Record<string, CleColonneClient> = {
  identifiantclient: "refExterne", idclient: "refExterne", identifiant: "refExterne",
  typedeclient: "type", typeclient: "type", type: "type",
  denomination: "denomination", raisonsociale: "denomination", societe: "denomination", entreprise: "denomination", client: "denomination",
  prenom: "prenom",
  nom: "nom", nomdefamille: "nom",
  siren: "siren", siret: "siren",
  numerodetva: "tva", numerotva: "tva", tva: "tva", tvaintracommunautaire: "tva",
  listedemails: "email", email: "email", mail: "email", adresseemail: "email", courriel: "email",
  telephone: "telephone", tel: "telephone", portable: "telephone", mobile: "telephone",
  adresse: "adresse", rue: "adresse",
  codepostal: "codePostal", cp: "codePostal",
  ville: "ville", commune: "ville",
  pays: "pays",
  conditionsdepaiement: "conditions", conditionspaiement: "conditions", delaidepaiement: "conditions",
};

const emailValide = z.string().email();

/** « Payable dès réception » → 0 ; « Paiement sous 30 jours » → 30 ; null si non reconnu. */
export function lireConditions(texte: string): number | null {
  const t = normaliser(texte);
  if (!t) return null;
  if (t.includes("reception") || t.includes("comptant") || t.includes("immediat")) return 0;
  const n = /(\d{1,3})/.exec(texte)?.[1];
  return n !== undefined && Number(n) <= 120 ? Number(n) : null;
}

/** Clé de rapprochement par nom (accents, casse et espaces ignorés). */
export const cleNom = (c: { type: string; firstName?: string | null; lastName?: string | null; companyName?: string | null }) =>
  normaliser(c.type === "PRO" && c.companyName ? c.companyName : `${c.firstName ?? ""}${c.lastName ?? ""}` || (c.companyName ?? ""));

/** Code postal français (5 chiffres) trouvé dans une adresse. */
export const codePostalDe = (adresse: string | null | undefined) => (adresse ? [...adresse.matchAll(/\b(\d{5})\b/g)].at(-1)?.[1] : undefined);

/** Valide chaque ligne (hors en-tête) et la transforme en client à créer ou mettre à jour. */
export function analyserLignesClients(rows: string[][]): { lignes: LigneClientAnalysee[]; erreurFichier?: string } {
  if (rows.length < 2) return { lignes: [], erreurFichier: "Le fichier ne contient aucune ligne de données (la ligne d'en-tête est attendue en première ligne)." };
  const entetes = rows[0].map((h) => SYNONYMES[normaliser(h)]);
  if (!entetes.includes("denomination") && !entetes.includes("nom")) {
    return { lignes: [], erreurFichier: "Colonne « Dénomination » ou « Nom » introuvable. Vérifiez la première ligne du fichier." };
  }
  if (rows.length - 1 > MAX_LIGNES_IMPORT_CLIENTS) return { lignes: [], erreurFichier: `Trop de lignes : ${MAX_LIGNES_IMPORT_CLIENTS} maximum par import.` };

  const refsVues = new Map<string, number>();
  const lignes: LigneClientAnalysee[] = [];
  for (let i = 1; i < rows.length; i++) {
    const brut = rows[i];
    if (brut.every((c) => c.trim() === "")) continue;
    const v: Partial<Record<CleColonneClient, string>> = {};
    entetes.forEach((cle, idx) => {
      // Première colonne reconnue retenue (Pennylane a « Adresse » puis « Adresse de Livraison »).
      if (cle && v[cle] === undefined && (brut[idx] ?? "").trim() !== "") v[cle] = brut[idx].trim();
    });
    const erreurs: string[] = [];
    const avertissements: string[] = [];
    const trop = (t: string | undefined, max: number) => (t && t.length > max ? t.slice(0, max) : t);

    const denomination = trop(v.denomination, 120);
    const prenom = trop(v.prenom, 60);
    const nom = trop(v.nom, 60);
    const typeTexte = normaliser(v.type ?? "");
    const pro = typeTexte ? /entreprise|pro|societe|professionnel|business|company/.test(typeTexte) : !!denomination && !prenom && !nom;
    const c: ClientImport = { type: pro ? "PRO" : "PARTICULIER" };
    if (pro) {
      c.companyName = denomination ?? [prenom, nom].filter(Boolean).join(" ");
      if (prenom) c.firstName = prenom;
      if (nom) c.lastName = nom;
    } else if (prenom || nom) {
      if (prenom) c.firstName = prenom;
      if (nom) c.lastName = nom;
    } else if (denomination) {
      c.lastName = denomination;
    }
    const libelle = c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ");
    if (!libelle) erreurs.push("Nom ou dénomination manquant.");

    if (v.refExterne) {
      const ref = v.refExterne.slice(0, 100);
      if (refsVues.has(ref)) erreurs.push(`Identifiant en double dans le fichier (déjà ligne ${refsVues.get(ref)}).`);
      else refsVues.set(ref, i + 1);
      c.refExterne = ref;
    }

    if (v.email) {
      const premier = v.email.split(/[,;\s]+/).find(Boolean)?.toLowerCase();
      if (premier && emailValide.safeParse(premier).success && premier.length <= 120) c.email = premier;
      else avertissements.push(`E-mail « ${v.email} » invalide : ignoré.`);
    }
    if (v.telephone) c.phone = v.telephone.slice(0, 30);
    if (v.siren) {
      const s = v.siren.replace(/\s/g, "");
      if (/^\d{9}$|^\d{14}$/.test(s)) c.siret = s;
      else avertissements.push(`SIREN/SIRET « ${v.siren} » invalide : ignoré.`);
    }
    if (v.tva) {
      const t = v.tva.replace(/\s/g, "").toUpperCase();
      if (/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(t)) c.tvaNumber = t;
      else avertissements.push(`N° de TVA « ${v.tva} » invalide : ignoré.`);
    }
    const pays = (v.pays ?? "").toUpperCase();
    const ville = [v.codePostal, v.ville].filter(Boolean).join(" ");
    const adresse = [v.adresse, ville, pays && pays !== "FR" && pays !== "FRANCE" ? pays : ""].filter(Boolean).join(", ");
    if (adresse) c.address = adresse.slice(0, 300);
    c.codePostal = v.codePostal && /^\d{5}$/.test(v.codePostal) ? v.codePostal : codePostalDe(adresse);
    if (v.conditions) {
      const j = lireConditions(v.conditions);
      if (j === null) avertissements.push(`Conditions de paiement « ${v.conditions} » non reconnues : 30 jours par défaut.`);
      else c.paymentTerms = j;
    }

    lignes.push({ ligne: i + 1, libelle, valeurs: erreurs.length ? undefined : c, erreurs, avertissements });
  }
  if (lignes.length === 0) return { lignes, erreurFichier: "Le fichier ne contient aucune ligne de données." };
  return { lignes };
}
