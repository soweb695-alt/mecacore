import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { rafraichirStatuts } from "@/lib/services/factures";

/** Factures impayées (échéance dépassée, solde restant) avec le nombre de relances et la date de la dernière. */
export async function facturesARelancer(now = new Date()) {
  await rafraichirStatuts(now);
  const factures = await db.facture.findMany({
    where: { statut: "IMPAYEE" },
    orderBy: { dateEcheance: "asc" },
    include: {
      client: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true, email: true, phone: true } },
      relances: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      _count: { select: { relances: true } },
    },
  });
  return factures.map((f) => ({
    id: f.id,
    numero: f.numero ?? "",
    client: f.client,
    dateEcheance: f.dateEcheance,
    joursRetard: Math.max(1, Math.floor((now.getTime() - f.dateEcheance.getTime()) / 864e5)),
    reste: Math.round((Number(f.totalTTC) - Number(f.montantPaye)) * 100) / 100,
    nombreRelances: f._count.relances,
    derniereRelance: f.relances[0]?.date ?? null,
  }));
}

/** « Marquer comme relancé » : trace une relance (date et auteur) ; le compteur est le nombre de relances enregistrées. */
export async function marquerRelancee(factureId: string, userId: string) {
  const f = await db.facture.findUnique({ where: { id: factureId }, select: { statut: true } });
  if (!f) throw new ApiError(404, "Facture introuvable", "INTROUVABLE");
  if (f.statut !== "IMPAYEE") throw new ApiError(409, "Seule une facture impayée peut être relancée", "STATUT_INVALIDE");
  const r = await db.relanceFacture.create({ data: { factureId, userId }, select: { date: true } });
  const nombreRelances = await db.relanceFacture.count({ where: { factureId } });
  return { nombreRelances, date: r.date };
}
