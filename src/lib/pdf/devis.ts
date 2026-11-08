import "server-only";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { genererPdf } from "@/lib/pdf/document";
import { garagePdf, lignesPdf, vehiculePdf } from "@/lib/pdf/lignes";
import { montantRemise } from "@/lib/remise";

/** PDF d'un devis (téléchargement et pièce jointe d'e-mail). Renvoie null si le devis est introuvable. */
export async function pdfDevis(id: string): Promise<{ numero: string; pdf: Uint8Array } | null> {
  const [d, garage] = await Promise.all([
    db.devis.findUnique({ where: { id }, include: { client: true, vehicule: true, lignes: { orderBy: { position: "asc" } } } }),
    garagePdf(),
  ]);
  if (!d || !garage) return null;
  const pdf = await genererPdf({
    titre: "Devis",
    numero: d.numero,
    dateEmission: d.dateCreation,
    dateSecondaire: { label: "Valable jusqu'au", date: d.dateValidite },
    garage,
    client: { nom: nomClient(d.client), adresse: d.client.address, email: d.client.email, siret: d.client.siret },
    vehicule: vehiculePdf(d.vehicule, d.kilometrage ?? d.vehicule?.kilometrage),
    lignes: await lignesPdf(d.lignes),
    remiseMontant: montantRemise(d.lignes.map((l) => ({ quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null }))),
    totaux: { totalHT: Number(d.totalHT), totalTVA: Number(d.totalTVA), totalTTC: Number(d.totalTTC) },
    remisePro: Number(d.remisePro),
    prixTTC: true,
    notes: ["Devis gratuit, valable jusqu'à la date indiquée. Bon pour accord : date et signature du client précédées de la mention « Bon pour accord »."],
  });
  return { numero: d.numero, pdf };
}
