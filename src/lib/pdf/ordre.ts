import "server-only";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { genererPdf } from "@/lib/pdf/document";
import { garagePdf, lignesPdf, remiseProTotal, vehiculePdf } from "@/lib/pdf/lignes";
import { montantRemise } from "@/lib/remise";
import { getFichier } from "@/lib/storage";

/**
 * PDF de l'ordre de réparation : travaux et pièces du devis, avec ou sans prix, et « Bon pour accord » signé par le
 * client sur la tablette (mention modifiable dans Paramètres › Facturation). Renvoie null si l'ordre est introuvable.
 */
export async function pdfOrdre(id: string, { prix }: { prix: boolean }): Promise<{ numero: string; pdf: Uint8Array } | null> {
  const [o, garage] = await Promise.all([
    db.ordreReparation.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true } },
        devis: { include: { client: true, vehicule: true, lignes: { orderBy: { position: "asc" } }, rendezVous: { orderBy: { debut: "asc" }, take: 1, select: { debut: true } } } },
      },
    }),
    garagePdf(),
  ]);
  if (!o || !garage) return null;
  const d = o.devis;
  const image = o.signatureUrl ? await getFichier(o.signatureUrl) : null;
  const lignes = await lignesPdf(d.lignes, prix ? garage.affichageRemise : "MASQUER", { sansPrix: !prix });
  const rdv = d.rendezVous[0]?.debut;
  const pdf = await genererPdf({
    titre: "Ordre de réparation",
    numero: o.numero,
    dateEmission: o.createdAt,
    dateSecondaire: rdv ? { label: "Rendez-vous le", date: rdv } : undefined,
    garage,
    client: { nom: nomClient(d.client), adresse: d.client.address, email: d.client.email, siret: d.client.siret },
    vehicule: vehiculePdf(d.vehicule, o.kilometrage ?? d.kilometrage ?? d.vehicule?.kilometrage),
    lignes: prix ? lignes : lignes.map((l) => ({ ...l, prixUnitaireHT: 0, tvaRate: 0, totalHT: 0, prixUnitaireTTC: undefined, totalTTC: undefined })),
    totaux: prix ? { totalHT: Number(d.totalHT), totalTVA: Number(d.totalTVA), totalTTC: Number(d.totalTTC) } : { totalHT: 0, totalTVA: 0, totalTTC: 0 },
    sansPrix: !prix,
    ...(prix
      ? {
          prixTTC: true,
          remiseProTotal: garage.affichageRemise === "TOTAL" ? remiseProTotal(d.lignes) : undefined,
          remiseMontant: montantRemise(d.lignes.map((l) => ({ quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null }))),
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
        }
      : {}),
    notes: [`Établi d'après le devis ${d.numero}.`, o.user ? `Technicien : ${o.user.firstName} ${o.user.lastName}.` : "", prix ? "" : "Les prix figurent sur le devis et sur la facture."].filter(Boolean),
    signature: { mention: garage.mentionAccordOR, nom: nomClient(d.client), le: o.signeLe, image: image ? new Uint8Array(image) : null },
  });
  return { numero: o.numero, pdf };
}
