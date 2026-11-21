import "server-only";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { genererPdf } from "@/lib/pdf/document";
import { garagePdf, lignesPdf, remiseProTotal, vehiculePdf } from "@/lib/pdf/lignes";
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
    lignes: await lignesPdf(d.lignes, garage.affichageRemise),
    // Remise PRO : par ligne (taux sous chaque pièce), dans les totaux, ou masquée (Paramètres › Facturation).
    remiseProTotal: garage.affichageRemise === "TOTAL" ? remiseProTotal(d.lignes) : undefined,
    remiseMontant: montantRemise(d.lignes.map((l) => ({ quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null }))),
    totaux: { totalHT: Number(d.totalHT), totalTVA: Number(d.totalTVA), totalTTC: Number(d.totalTTC) },
    remisePro: garage.affichageRemise === "LIGNE" ? Number(d.remisePro) : undefined,
    remiseGlobale:
      d.totalHTAvantRemise !== null && Number(d.remiseGlobaleMontant) > 0
        ? {
            libelle: `Remise ${d.remiseGlobaleType === "POURCENT" ? `${String(Number(d.remiseGlobaleValeur)).replace(".", ",")} %` : "commerciale"} (sur ${d.remiseGlobaleBase})`,
            montant: Number(d.remiseGlobaleMontant),
            totalHTAvantRemise: Number(d.totalHTAvantRemise),
            ...(d.remiseGlobaleBase === "TTC" ? { totalTTCAvantRemise: Math.round((Number(d.totalTTC) + Number(d.remiseGlobaleMontant)) * 100) / 100 } : {}),
          }
        : undefined,
    prixTTC: true,
    notes: ["Devis gratuit, valable jusqu'à la date indiquée. Bon pour accord : date et signature du client précédées de la mention « Bon pour accord »."],
  });
  return { numero: d.numero, pdf };
}
