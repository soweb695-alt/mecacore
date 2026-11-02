import "server-only";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { genererPdf } from "@/lib/pdf/document";
import { garagePdf } from "@/lib/pdf/lignes";

/** PDF d'un bon de livraison (sans prix) : téléchargement et pièce jointe d'e-mail. */
export async function pdfBonLivraison(id: string): Promise<{ numero: string; pdf: Uint8Array } | null> {
  const [bl, garage] = await Promise.all([
    db.bonLivraison.findUnique({ where: { id }, include: { client: true, lignes: true, devis: { select: { numero: true } } } }),
    garagePdf(),
  ]);
  if (!bl || !garage || !bl.client) return null;
  const pdf = await genererPdf({
    titre: "Bon de livraison",
    numero: bl.numero,
    dateEmission: bl.dateLivraison,
    dateSecondaire: bl.livreLe ? { label: "Livré le", date: bl.livreLe } : undefined,
    garage,
    client: { nom: nomClient(bl.client), adresse: bl.client.address, email: bl.client.email, siret: bl.client.siret },
    lignes: bl.lignes.map((l) => ({ designation: l.designation || "Pièce", quantite: l.quantite, prixUnitaireHT: 0, tvaRate: 0, totalHT: 0 })),
    totaux: { totalHT: 0, totalTVA: 0, totalTTC: 0 },
    sansPrix: true,
    notes: [bl.devis ? `Réf. devis ${bl.devis.numero}.` : "", "Merci de vérifier les pièces à la remise. Les prix figurent sur la facture."].filter(Boolean),
  });
  return { numero: bl.numero, pdf };
}
