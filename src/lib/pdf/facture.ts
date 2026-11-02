import "server-only";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { round2 } from "@/lib/money";
import { genererPdf } from "@/lib/pdf/document";
import { garagePdf, lignesPdf, vehiculePdf } from "@/lib/pdf/lignes";
import { montantRemise } from "@/lib/remise";

/** PDF d'une facture (téléchargement, export groupé). Un brouillon est marqué comme tel, sans numéro. */
export async function pdfFacture(id: string): Promise<{ nom: string; pdf: Uint8Array } | null> {
  const [f, garage] = await Promise.all([
    db.facture.findUnique({ where: { id }, include: { client: true, paiements: { select: { mode: true } }, lignes: { orderBy: { position: "asc" } }, devis: { include: { vehicule: true } }, bonsLivraison: { select: { numero: true }, orderBy: { numero: "asc" } } } }),
    garagePdf(),
  ]);
  if (!f || !garage) return null;
  const brouillon = f.statut === "BROUILLON";
  const pdf = await genererPdf({
    titre: brouillon ? "Facture (brouillon)" : "Facture",
    numero: f.numero ?? "non attribué",
    dateEmission: f.dateEmission,
    dateSecondaire: { label: "Échéance", date: f.dateEcheance },
    garage,
    client: { nom: nomClient(f.client), adresse: f.client.address, email: f.client.email, siret: f.client.siret },
    vehicule: vehiculePdf(f.devis?.vehicule, f.kilometrage ?? f.devis?.kilometrage),
    lignes: await lignesPdf(f.lignes),
    remiseMontant: montantRemise(f.lignes.map((l) => ({ quantite: Number(l.quantite), prixUnitaireHT: Number(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT !== null ? Number(l.prixCatalogueHT) : null }))),
    totaux: { totalHT: Number(f.totalHT), totalTVA: Number(f.totalTVA), totalTTC: Number(f.totalTTC) },
    remisePro: Number(f.remisePro),
    remiseGlobale:
      f.totalHTAvantRemise !== null && Number(f.remiseGlobaleMontant) > 0
        ? {
            libelle: `Remise ${f.remiseGlobaleType === "POURCENT" ? `${String(Number(f.remiseGlobaleValeur)).replace(".", ",")} %` : "commerciale"} (sur ${f.remiseGlobaleBase})`,
            montant: Number(f.remiseGlobaleMontant),
            totalHTAvantRemise: Number(f.totalHTAvantRemise),
          }
        : undefined,
    virement:
      (f.modePaiement === "VIREMENT" || f.paiements.some((p) => p.mode === "VIREMENT")) && garage.iban && garage.bic ? { iban: garage.iban, bic: garage.bic, titulaire: garage.nom } : undefined,
    paiement: { paye: Number(f.montantPaye), reste: round2(Number(f.totalTTC) - Number(f.montantPaye)) },
    notes: [
      ...(brouillon ? ["Document de travail : facture non émise, sans valeur comptable."] : []),
      ...(f.devis || f.bonsLivraison.length === 0 ? [] : [`Bons de livraison facturés : ${f.bonsLivraison.map((b) => b.numero).join(", ")}.`]),
      "En cas de retard de paiement, une indemnité forfaitaire de 40 € pour frais de recouvrement sera exigible (art. L441-10 du Code de commerce). Pas d'escompte pour paiement anticipé.",
    ],
  });
  return { nom: f.numero ?? `brouillon-${f.id}`, pdf };
}
