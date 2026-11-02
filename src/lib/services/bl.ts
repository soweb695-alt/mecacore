import "server-only";
import { db, type Tx } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { emailBonLivraison } from "@/lib/messages/templates";
import { nomClient } from "@/lib/format";
import { pdfBonLivraison } from "@/lib/pdf/bl";
import { prochainNumero } from "@/lib/numbering";
import { envoyerEmail } from "@/lib/services/messages";

export async function creerBonCommande(input: { fournisseur: string; lignes: { pieceId: string; quantite: number }[] }) {
  return db.$transaction(async (tx) => {
    const ids = [...new Set(input.lignes.map((l) => l.pieceId))];
    const n = await tx.piece.count({ where: { id: { in: ids }, isActive: true } });
    if (n !== ids.length) throw new ApiError(400, "Une pièce est introuvable", "PIECE_INTROUVABLE");
    const numero = await prochainNumero(tx, "BC");
    const bc = await tx.bonCommande.create({ data: { numero, fournisseur: input.fournisseur, lignes: { create: input.lignes } } });
    return { id: bc.id, numero };
  });
}

/** Réception (totale ou partielle) : le stock est incrémenté, jamais au-delà de la quantité commandée. */
export async function receptionnerBonCommande(id: string, lignes: { ligneId: string; quantite: number }[]) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BonCommande" WHERE id = ${id} FOR UPDATE`;
    const bc = await tx.bonCommande.findUnique({ where: { id }, include: { lignes: true } });
    if (!bc) throw new ApiError(404, "Bon de commande introuvable", "INTROUVABLE");
    if (bc.statut === "RECEPTIONNEE") throw new ApiError(409, "Ce bon de commande est déjà réceptionné", "STATUT_INVALIDE");

    for (const r of lignes) {
      if (r.quantite === 0) continue;
      const l = bc.lignes.find((x) => x.id === r.ligneId);
      if (!l) throw new ApiError(400, "Ligne inconnue", "LIGNE_INVALIDE");
      if (l.quantiteRecue + r.quantite > l.quantite) throw new ApiError(400, "Quantité reçue supérieure à la quantité commandée", "QUANTITE_INVALIDE");
      await tx.ligneBonCommande.update({ where: { id: l.id }, data: { quantiteRecue: { increment: r.quantite } } });
      await tx.$executeRaw`UPDATE "Piece" SET stock = stock + ${r.quantite}, "updatedAt" = NOW() WHERE id = ${l.pieceId}`;
      l.quantiteRecue += r.quantite;
    }
    const toutRecu = bc.lignes.every((l) => l.quantiteRecue >= l.quantite);
    const rienRecu = bc.lignes.every((l) => l.quantiteRecue === 0);
    const statut = toutRecu ? "RECEPTIONNEE" : rienRecu ? "EN_ATTENTE" : "RECEPTIONNEE_PARTIELLE";
    await tx.bonCommande.update({ where: { id }, data: { statut } });
    return { id, statut };
  });
}

export async function creerBonLivraison(input: { clientId: string; bonCommandeId?: string | null; lignes: { pieceId: string; quantite: number }[] }) {
  return db.$transaction(async (tx) => {
    const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { isActive: true, anonymiseLe: true } });
    if (!client || !client.isActive || client.anonymiseLe) throw new ApiError(400, "Client introuvable", "CLIENT_INTROUVABLE");
    const ids = [...new Set(input.lignes.map((l) => l.pieceId))];
    const pieces = await tx.piece.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, reference: true } });
    if (pieces.length !== ids.length) throw new ApiError(400, "Une pièce est introuvable", "PIECE_INTROUVABLE");
    // Regroupement : les quantités d'une même pièce sont additionnées sur le bon.
    const groupees = new Map<string, number>();
    for (const l of input.lignes) groupees.set(l.pieceId, (groupees.get(l.pieceId) ?? 0) + l.quantite);
    const numero = await prochainNumero(tx, "BL");
    const bl = await tx.bonLivraison.create({
      data: {
        numero,
        clientId: input.clientId,
        bonCommandeId: input.bonCommandeId ?? null,
        lignes: { create: [...groupees].map(([pieceId, quantite]) => ({ pieceId, quantite, designation: `${pieces.find((p) => p.id === pieceId)!.nom} (${pieces.find((p) => p.id === pieceId)!.reference})` })) },
      },
    });
    return { id: bl.id, numero };
  });
}

/** En attente → Prêt à être retiré. L'envoi automatique de SMS est désactivé pour l'instant. */
export async function marquerPrete(id: string) {
  const r = await db.bonLivraison.updateMany({ where: { id, statut: "EN_ATTENTE" }, data: { statut: "PRETE" } });
  if (r.count === 0) {
    const bl = await db.bonLivraison.findUnique({ where: { id }, select: { id: true } });
    if (!bl) throw new ApiError(404, "Bon de livraison introuvable", "INTROUVABLE");
    throw new ApiError(409, "Ce bon n'est plus en attente", "STATUT_INVALIDE");
  }
  return { id };
}

export type ResultatEmailBl = "envoye" | "sans_email" | "non_configure" | "echec";

/**
 * Envoie le bon de livraison (PDF sans prix) au client et trace l'envoi dans son historique (MessageLog).
 * Ne lève jamais d'erreur d'envoi : le résultat est renvoyé pour être affiché à l'utilisateur.
 */
export async function envoyerBonLivraisonParEmail(id: string): Promise<{ resultat: ResultatEmailBl; destinataire: string | null }> {
  const bl = await db.bonLivraison.findUnique({ where: { id }, include: { client: true } });
  if (!bl) throw new ApiError(404, "Bon de livraison introuvable", "INTROUVABLE");
  const email = bl.client?.email ?? null;
  if (!bl.client || bl.client.anonymiseLe || !email) return { resultat: "sans_email", destinataire: null };
  const doc = await pdfBonLivraison(id);
  if (!doc) return { resultat: "echec", destinataire: email };
  const params = await db.parametreGarage.findUnique({ where: { id: 1 } });
  const mail = emailBonLivraison({ garage: params?.nomGarage ?? "Garage", numero: bl.numero, client: nomClient(bl.client), telephone: params?.telephone ?? "" });
  const n = (await db.messageLog.count({ where: { cle: { startsWith: `bl:${id}:livre:` } } })) + 1;
  const res = await envoyerEmail({
    cle: `bl:${id}:livre:${n}`,
    clientId: bl.clientId,
    template: "bon_livraison",
    destinataire: email,
    subject: mail.subject,
    html: mail.html,
    attachments: [{ name: `${bl.numero}.pdf`, content: Buffer.from(doc.pdf) }],
  });
  const resultat: ResultatEmailBl = res === "envoye" ? "envoye" : res === "simulation" ? "non_configure" : "echec";
  return { resultat, destinataire: email };
}

/**
 * Prêt à être retiré → Livré : confirme que le client a récupéré ses pièces, puis envoie automatiquement
 * le bon de livraison par e-mail. Le passage à « Livré » n'est jamais bloqué par l'envoi.
 */
export async function marquerLivre(id: string) {
  const r = await db.bonLivraison.updateMany({ where: { id, statut: "PRETE" }, data: { statut: "LIVREE", livreLe: new Date() } });
  if (r.count === 0) {
    const bl = await db.bonLivraison.findUnique({ where: { id }, select: { id: true } });
    if (!bl) throw new ApiError(404, "Bon de livraison introuvable", "INTROUVABLE");
    throw new ApiError(409, "Le bon doit d'abord être « Prêt à être retiré »", "STATUT_INVALIDE");
  }
  const email = await envoyerBonLivraisonParEmail(id).catch(() => ({ resultat: "echec" as const, destinataire: null }));
  return { id, email };
}

/** Un bon de commande n'est modifiable ou supprimable que tant qu'aucune pièce n'a été reçue. */
async function bonNonRecu(tx: Tx, id: string) {
  const bc = await tx.bonCommande.findUnique({ where: { id }, include: { lignes: true } });
  if (!bc) throw new ApiError(404, "Bon de commande introuvable", "INTROUVABLE");
  if (bc.lignes.some((l) => l.quantiteRecue > 0) || bc.statut !== "EN_ATTENTE") {
    throw new ApiError(409, "Ce bon de commande a déjà été réceptionné", "STATUT_INVALIDE");
  }
  return bc;
}

export async function modifierBonCommande(id: string, input: { fournisseur: string; lignes: { pieceId: string; quantite: number }[] }) {
  return db.$transaction(async (tx) => {
    await bonNonRecu(tx, id);
    const ids = [...new Set(input.lignes.map((l) => l.pieceId))];
    if ((await tx.piece.count({ where: { id: { in: ids }, isActive: true } })) !== ids.length) throw new ApiError(400, "Une pièce est introuvable", "PIECE_INTROUVABLE");
    await tx.ligneBonCommande.deleteMany({ where: { bonCommandeId: id } });
    await tx.bonCommande.update({ where: { id }, data: { fournisseur: input.fournisseur, lignes: { create: input.lignes } } });
    return { id };
  });
}

export async function supprimerBonCommande(id: string) {
  return db.$transaction(async (tx) => {
    await bonNonRecu(tx, id);
    await tx.bonCommande.delete({ where: { id } });
    return { id };
  });
}
