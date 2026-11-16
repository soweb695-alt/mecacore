import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { analyserLignesClients, cleNom, codePostalDe, type ClientImport } from "@/lib/import-clients";

export type ActionImportClient = "creer" | "maj" | "ignore" | "erreur";

export interface ResultatLigneClient {
  ligne: number;
  libelle: string;
  action: ActionImportClient;
  messages: string[];
}

export interface ResultatImportClients {
  appliquee: boolean;
  erreurFichier?: string;
  lignes: ResultatLigneClient[];
  crees: number;
  misAJour: number;
  ignores: number;
  erreurs: number;
}

type Existant = { id: string; refExterne: string | null; type: string; firstName: string | null; lastName: string | null; companyName: string | null; email: string | null; address: string | null; anonymiseLe: Date | null };

const compter = <T,>(cles: (T | undefined)[]) => {
  const m = new Map<T, number>();
  for (const k of cles) if (k !== undefined) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
};

/** Champs renseignés dans le fichier : une mise à jour n'efface jamais une donnée saisie dans MecaCore. */
function donnees(c: ClientImport): Prisma.ClientUpdateInput {
  return {
    type: c.type,
    ...(c.refExterne ? { refExterne: c.refExterne } : {}),
    ...(c.firstName ? { firstName: c.firstName } : {}),
    ...(c.lastName ? { lastName: c.lastName } : {}),
    ...(c.companyName ? { companyName: c.companyName } : {}),
    ...(c.siret ? { siret: c.siret } : {}),
    ...(c.tvaNumber ? { tvaNumber: c.tvaNumber } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.address ? { address: c.address } : {}),
    ...(c.paymentTerms !== undefined ? { paymentTerms: c.paymentTerms } : {}),
  };
}

/**
 * Import de clients (export Pennylane ou fichier simple). Pour chaque ligne :
 *  1. même identifiant d'origine (refExterne) → mise à jour de cette fiche ;
 *  2. sinon, client saisi dans MecaCore (sans identifiant) avec le même e-mail, ou le même nom et code postal,
 *     si la correspondance est unique des deux côtés → mise à jour et l'identifiant y est mémorisé ;
 *  3. sinon → création (accord marketing à « non » : le RGPD exige un consentement explicite).
 * Un client anonymisé (droit à l'oubli) n'est jamais modifié ni recréé. `appliquer = false` : aperçu seul.
 */
export async function importerClients(rows: string[][], appliquer: boolean): Promise<ResultatImportClients> {
  const { lignes, erreurFichier } = analyserLignesClients(rows);
  if (erreurFichier) return { appliquee: false, erreurFichier, lignes: [], crees: 0, misAJour: 0, ignores: 0, erreurs: 0 };

  const existants: Existant[] = await db.client.findMany({ select: { id: true, refExterne: true, type: true, firstName: true, lastName: true, companyName: true, email: true, address: true, anonymiseLe: true } });
  const parRef = new Map(existants.filter((e) => e.refExterne).map((e) => [e.refExterne!, e]));
  const libres = existants.filter((e) => !e.refExterne && !e.anonymiseLe);
  const cleNomCp = (c: { type: string; firstName?: string | null; lastName?: string | null; companyName?: string | null }, cp: string | undefined) => (cp ? `${cleNom(c)}|${cp}` : undefined);
  const baseEmail = compter(existants.map((e) => e.email?.toLowerCase() ?? undefined));
  const baseNomCp = compter(existants.map((e) => cleNomCp(e, codePostalDe(e.address))));
  const fichierEmail = compter(lignes.map((l) => l.valeurs?.email));
  const fichierNomCp = compter(lignes.map((l) => (l.valeurs ? cleNomCp(l.valeurs, l.valeurs.codePostal) : undefined)));

  const pris = new Set<string>();
  const resultats: ResultatLigneClient[] = [];
  const aAppliquer: { c: ClientImport; id?: string }[] = [];

  for (const l of lignes) {
    if (!l.valeurs) {
      resultats.push({ ligne: l.ligne, libelle: l.libelle, action: "erreur", messages: l.erreurs });
      continue;
    }
    const c = l.valeurs;
    const messages = [...l.avertissements];
    let cible: Existant | undefined = c.refExterne ? parRef.get(c.refExterne) : undefined;
    if (!cible && c.email && fichierEmail.get(c.email) === 1 && baseEmail.get(c.email) === 1) {
      cible = libres.find((e) => e.email?.toLowerCase() === c.email);
      if (cible) messages.push("Rapproché par l'e-mail d'un client déjà saisi.");
    }
    const nomCp = cleNomCp(c, c.codePostal);
    if (!cible && nomCp && fichierNomCp.get(nomCp) === 1 && baseNomCp.get(nomCp) === 1) {
      cible = libres.find((e) => cleNomCp(e, codePostalDe(e.address)) === nomCp);
      if (cible) messages.push("Rapproché par le nom et le code postal d'un client déjà saisi.");
    }
    if (cible?.anonymiseLe) {
      resultats.push({ ligne: l.ligne, libelle: l.libelle, action: "ignore", messages: ["Client anonymisé (droit à l'oubli) : ni modifié ni recréé."] });
      continue;
    }
    if (cible && pris.has(cible.id)) cible = undefined; // une fiche n'est mise à jour qu'une fois par import
    if (cible) pris.add(cible.id);
    resultats.push({ ligne: l.ligne, libelle: l.libelle, action: cible ? "maj" : "creer", messages });
    aAppliquer.push({ c, id: cible?.id });
  }

  if (appliquer && aAppliquer.length > 0) {
    await db.$transaction(
      async (tx) => {
        for (const { c, id } of aAppliquer) {
          if (id) await tx.client.update({ where: { id }, data: donnees(c) });
          else await tx.client.create({ data: { ...(donnees(c) as Prisma.ClientCreateInput), marketingOptIn: false, paymentTerms: c.paymentTerms ?? 30 } });
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  return {
    appliquee: appliquer,
    lignes: resultats,
    crees: resultats.filter((r) => r.action === "creer").length,
    misAJour: resultats.filter((r) => r.action === "maj").length,
    ignores: resultats.filter((r) => r.action === "ignore").length,
    erreurs: resultats.filter((r) => r.action === "erreur").length,
  };
}
