import "server-only";
import { db } from "@/lib/db";
import { couleurCollaborateur } from "@/lib/colors";
import { round2 } from "@/lib/money";
import { ajouterJoursStr, jourParis, parisVersUtc } from "@/lib/time";

export type Periode = "mois" | "trimestre" | "annee";

export function bornesPeriode(periode: Periode, now = new Date()): { du: Date; au: Date; libelle: string } {
  const j = jourParis(now);
  const [y, m] = j.split("-").map(Number);
  let debut: string;
  let fin: string;
  if (periode === "annee") {
    debut = `${y}-01-01`;
    fin = `${y + 1}-01-01`;
  } else if (periode === "trimestre") {
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    debut = `${y}-${String(q).padStart(2, "0")}-01`;
    fin = q + 3 > 12 ? `${y + 1}-01-01` : `${y}-${String(q + 3).padStart(2, "0")}-01`;
  } else {
    debut = `${y}-${String(m).padStart(2, "0")}-01`;
    fin = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  }
  const libelle = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${debut}T12:00:00Z`));
  return { du: parisVersUtc(`${debut}T00:00`), au: parisVersUtc(`${fin}T00:00`), libelle: periode === "mois" ? libelle : periode === "annee" ? `Année ${y}` : `Trimestre depuis ${libelle}` };
}

export async function analyser(periode: Periode, now = new Date()) {
  const { du, au, libelle } = bornesPeriode(periode, now);
  const factures = await db.facture.findMany({
    where: { statut: { notIn: ["ANNULEE", "BROUILLON"] }, dateEmission: { gte: du, lt: au } },
    include: {
      lignes: true,
      user: { select: { id: true, firstName: true, lastName: true, couleur: true } },
      devis: { select: { user: { select: { id: true, firstName: true, lastName: true, couleur: true } }, ordre: { select: { user: { select: { id: true, firstName: true, lastName: true, couleur: true } } } } } },
    },
  });

  let caHT = 0;
  let cout = 0;
  const parCollab = new Map<string, { nom: string; ca: number; couleur: string }>();
  const parPiece = new Map<string, { qte: number; ca: number; cout: number }>();
  for (const f of factures) {
    const ht = Number(f.totalHT);
    caHT += ht;
    // Attribution : mécanicien de l'OR s'il existe, sinon auteur du devis (ventes de pièces).
    const u = f.devis?.ordre?.user ?? f.devis?.user ?? f.user ?? { id: "inconnu", firstName: "Non", lastName: "attribué", couleur: "#9ca3af" };
    const cur = parCollab.get(u.id) ?? { nom: `${u.firstName} ${u.lastName}`, ca: 0, couleur: couleurCollaborateur(u.id, u.couleur) };
    cur.ca += ht;
    parCollab.set(u.id, cur);
    for (const l of f.lignes) {
      if (l.prixAchatHT !== null) cout += Number(l.prixAchatHT) * Number(l.quantite);
      if (l.type === "PIECE" && l.pieceId) {
        const p = parPiece.get(l.pieceId) ?? { qte: 0, ca: 0, cout: 0 };
        p.qte += Number(l.quantite);
        p.ca += Number(l.totalHT);
        p.cout += Number(l.prixAchatHT ?? 0) * Number(l.quantite);
        parPiece.set(l.pieceId, p);
      }
    }
  }
  const pieces = await db.piece.findMany({ where: { id: { in: [...parPiece.keys()] } }, select: { id: true, reference: true, nom: true } });
  const topPieces = [...parPiece.entries()]
    .map(([id, v]) => ({ id, reference: pieces.find((p) => p.id === id)?.reference ?? "?", nom: pieces.find((p) => p.id === id)?.nom ?? "Pièce supprimée", qte: v.qte, ca: round2(v.ca), marge: round2(v.ca - v.cout) }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10);

  const devis = await db.devis.groupBy({ by: ["statut"], where: { dateCreation: { gte: du, lt: au } }, _count: true });
  const nb = (s: string) => devis.find((d) => d.statut === s)?._count ?? 0;
  const traites = nb("VALIDE") + nb("REJETE") + nb("ENVOYE");

  // CA des 6 derniers mois (indépendant de la période choisie).
  const [y, m] = jourParis(now).split("-").map(Number);
  const mois: { label: string; ca: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1, 12));
    const debut = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const fin = ajouterJoursStr(`${new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12)).toISOString().slice(0, 10)}`, 0);
    const agg = await db.facture.aggregate({ _sum: { totalHT: true }, where: { statut: { notIn: ["ANNULEE", "BROUILLON"] }, dateEmission: { gte: parisVersUtc(`${debut}T00:00`), lt: parisVersUtc(`${fin}T00:00`) } } });
    mois.push({ label: new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "short" }).format(d), ca: round2(Number(agg._sum.totalHT ?? 0)) });
  }

  return {
    libelle,
    caHT: round2(caHT),
    marge: round2(caHT - cout),
    margePct: caHT > 0 ? Math.round(((caHT - cout) / caHT) * 100) : 0,
    nbFactures: factures.length,
    panierMoyen: factures.length ? round2(caHT / factures.length) : 0,
    tauxValidation: traites > 0 ? Math.round((nb("VALIDE") / traites) * 100) : 0,
    devisValides: nb("VALIDE"),
    devisTotal: traites,
    parCollaborateur: [...parCollab.values()].map((c) => ({ nom: c.nom, ca: round2(c.ca), couleur: c.couleur })).sort((a, b) => b.ca - a.ca),
    topPieces,
    mois,
    factures: factures.map((f) => ({ numero: f.numero, date: f.dateEmission, totalHT: Number(f.totalHT), totalTTC: Number(f.totalTTC), statut: f.statut })),
  };
}
