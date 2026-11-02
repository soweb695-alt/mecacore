import "server-only";
import { db } from "@/lib/db";
import { canSeePurchasePrice, type PermissionUser } from "@/lib/permissions";
import { analyserLignes, type LigneAnalysee, type PieceImport } from "@/lib/import-pieces";
import { verifierReapprovisionnement } from "@/lib/services/reappro";

export type ActionImport = "creer" | "maj" | "erreur";

export interface ResultatLigne {
  ligne: number;
  reference: string;
  action: ActionImport;
  messages: string[];
}

export interface ResultatImport {
  appliquee: boolean;
  erreurFichier?: string;
  lignes: ResultatLigne[];
  crees: number;
  misAJour: number;
  erreurs: number;
  avertissements: string[];
}

/**
 * Crée ou met à jour des pièces en masse.
 *  - référence existante → mise à jour des seules colonnes renseignées ; le stock saisi est AJOUTÉ au stock actuel ;
 *  - nouvelle référence → désignation et prix de vente obligatoires ;
 *  - lignes en erreur : jamais appliquées, listées avec leur motif (les lignes valides le sont).
 * `appliquer = false` : simple aperçu, rien n'est écrit.
 */
export async function importerPieces(user: PermissionUser, rows: string[][], appliquer: boolean): Promise<ResultatImport> {
  const { lignes, erreurFichier } = analyserLignes(rows);
  const vide: ResultatImport = { appliquee: false, erreurFichier, lignes: [], crees: 0, misAJour: 0, erreurs: 0, avertissements: [] };
  if (erreurFichier) return vide;

  const achatAutorise = canSeePurchasePrice(user);
  const avertissements: string[] = [];
  if (!achatAutorise && lignes.some((l) => l.valeurs?.prixAchatHT !== undefined)) {
    avertissements.push("La colonne « Prix achat HT » est ignorée : votre rôle n'a pas accès aux prix d'achat.");
  }

  const references = lignes.flatMap((l) => (l.valeurs ? [l.valeurs.reference] : []));
  const existantes = new Map((await db.piece.findMany({ where: { reference: { in: references } }, select: { id: true, reference: true, isActive: true } })).map((p) => [p.reference, p]));

  const resultats: ResultatLigne[] = [];
  const aAppliquer: { l: LigneAnalysee & { valeurs: PieceImport }; existante?: { id: string } }[] = [];
  for (const l of lignes) {
    if (!l.valeurs) {
      resultats.push({ ligne: l.ligne, reference: "", action: "erreur", messages: l.erreurs });
      continue;
    }
    const existante = existantes.get(l.valeurs.reference);
    if (!existante) {
      const manques = [l.valeurs.nom === undefined && "désignation", l.valeurs.prixVenteHT === undefined && "prix de vente HT"].filter(Boolean);
      if (manques.length) {
        resultats.push({ ligne: l.ligne, reference: l.valeurs.reference, action: "erreur", messages: [`Nouvelle pièce : ${manques.join(" et ")} obligatoire${manques.length > 1 ? "s" : ""}.`] });
        continue;
      }
    }
    resultats.push({ ligne: l.ligne, reference: l.valeurs.reference, action: existante ? "maj" : "creer", messages: existante && !existante.isActive ? ["Pièce désactivée : elle sera réactivée."] : [] });
    aAppliquer.push({ l: l as LigneAnalysee & { valeurs: PieceImport }, existante });
  }

  if (appliquer && aAppliquer.length > 0) {
    await db.$transaction(
      async (tx) => {
        const touchees: string[] = [];
        for (const { l, existante } of aAppliquer) {
          const v = l.valeurs;
          const commun = {
            ...(v.nom !== undefined ? { nom: v.nom } : {}),
            ...(v.marque !== undefined ? { marque: v.marque } : {}),
            ...(v.fournisseur !== undefined ? { fournisseur: v.fournisseur } : {}),
            ...(v.categorie !== undefined ? { categorie: v.categorie } : {}),
            ...(achatAutorise && v.prixAchatHT !== undefined ? { prixAchatHT: v.prixAchatHT } : {}),
            ...(v.prixVenteHT !== undefined ? { prixVenteHT: v.prixVenteHT } : {}),
            ...(v.seuilAlerte !== undefined ? { seuilAlerte: v.seuilAlerte } : {}),
            ...(v.taillePneu !== undefined ? { taillePneu: v.taillePneu } : {}),
            ...(v.referencesCroisees !== undefined ? { referencesCroisees: v.referencesCroisees } : {}),
          };
          if (existante) {
            await tx.piece.update({ where: { id: existante.id }, data: { ...commun, isActive: true, ...(v.stock ? { stock: { increment: v.stock } } : {}) } });
            touchees.push(existante.id);
          } else {
            const p = await tx.piece.create({ data: { reference: v.reference, nom: v.nom!, prixVenteHT: v.prixVenteHT!, ...commun, stock: v.stock ?? 0 }, select: { id: true } });
            touchees.push(p.id);
          }
        }
        // Une pièce qui se retrouve au seuil d'alerte déclenche son bon de commande automatique.
        await verifierReapprovisionnement(tx, touchees);
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  return {
    appliquee: appliquer,
    lignes: resultats,
    crees: resultats.filter((r) => r.action === "creer").length,
    misAJour: resultats.filter((r) => r.action === "maj").length,
    erreurs: resultats.filter((r) => r.action === "erreur").length,
    avertissements,
  };
}
