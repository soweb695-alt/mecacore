import "server-only";
import ExcelJS from "exceljs";
import { APP_NAME } from "@/lib/app";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { round2 } from "@/lib/money";
import { pdfFacture } from "@/lib/pdf/facture";

const STATUTS: Record<string, string> = { BROUILLON: "Brouillon", EMISE: "Émise", PARTIELLEMENT_PAYEE: "Partiellement payée", PAYEE: "Payée", IMPAYEE: "Impayée", ANNULEE: "Annulée" };
const TYPES: Record<string, string> = { MAIN_OEUVRE: "Main d'œuvre", FORFAIT: "Forfait", PIECE: "Pièce", FRAIS_DIVERS: "Frais divers" };

async function charger(ids: string[]) {
  return db.facture.findMany({
    where: { id: { in: ids } },
    orderBy: [{ dateEmission: "asc" }, { numero: "asc" }],
    include: { client: true, lignes: { orderBy: { position: "asc" } }, devis: { select: { numero: true, vehicule: { select: { immatriculation: true } } } } },
  });
}

/** Classeur Excel des factures sélectionnées : une feuille « Factures » (une ligne par facture) et une feuille « Lignes ». */
export async function facturesVersXlsx(ids: string[]): Promise<Buffer> {
  const factures = await charger(ids);
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  const ws = wb.addWorksheet("Factures");
  ws.columns = [
    { header: "N°", key: "numero", width: 16 },
    { header: "Date d'émission", key: "date", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Échéance", key: "echeance", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Client", key: "client", width: 28 },
    { header: "SIRET client", key: "siret", width: 16 },
    { header: "Devis", key: "devis", width: 14 },
    { header: "Immatriculation", key: "immat", width: 14 },
    { header: "Kilométrage", key: "km", width: 12 },
    { header: "Total HT", key: "ht", width: 12, style: { numFmt: "#,##0.00 €" } },
    { header: "TVA", key: "tva", width: 12, style: { numFmt: "#,##0.00 €" } },
    { header: "Total TTC", key: "ttc", width: 12, style: { numFmt: "#,##0.00 €" } },
    { header: "Payé", key: "paye", width: 12, style: { numFmt: "#,##0.00 €" } },
    { header: "Reste dû", key: "reste", width: 12, style: { numFmt: "#,##0.00 €" } },
    { header: "Statut", key: "statut", width: 18 },
    { header: "Mode de règlement", key: "mode", width: 16 },
  ];
  for (const f of factures) {
    ws.addRow({
      numero: f.numero ?? "Brouillon",
      date: f.dateEmission,
      echeance: f.dateEcheance,
      client: nomClient(f.client),
      siret: f.client.siret ?? "",
      devis: f.devis?.numero ?? "",
      immat: f.devis?.vehicule?.immatriculation ?? "",
      km: f.kilometrage ?? "",
      ht: Number(f.totalHT),
      tva: Number(f.totalTVA),
      ttc: Number(f.totalTTC),
      paye: Number(f.montantPaye),
      reste: f.statut === "ANNULEE" ? 0 : round2(Number(f.totalTTC) - Number(f.montantPaye)),
      statut: STATUTS[f.statut] ?? f.statut,
      mode: f.modePaiement ?? "",
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const wl = wb.addWorksheet("Lignes");
  wl.columns = [
    { header: "N° facture", key: "numero", width: 16 },
    { header: "Type", key: "type", width: 14 },
    { header: "Désignation", key: "designation", width: 44 },
    { header: "Quantité", key: "qte", width: 10 },
    { header: "PU HT", key: "pu", width: 12, style: { numFmt: "#,##0.00 €" } },
    { header: "TVA %", key: "tva", width: 8 },
    { header: "Total HT", key: "ht", width: 12, style: { numFmt: "#,##0.00 €" } },
  ];
  for (const f of factures) {
    for (const l of f.lignes) {
      wl.addRow({ numero: f.numero ?? "Brouillon", type: TYPES[l.type] ?? l.type, designation: l.designation, qte: Number(l.quantite), pu: Number(l.prixUnitaireHT), tva: Number(l.tvaRate), ht: Number(l.totalHT) });
    }
  }
  wl.getRow(1).font = { bold: true };
  wl.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** PDF unique regroupant les factures sélectionnées, dans l'ordre chronologique. */
export async function facturesVersPdf(ids: string[]): Promise<Uint8Array> {
  const factures = await db.facture.findMany({ where: { id: { in: ids } }, orderBy: [{ dateEmission: "asc" }, { numero: "asc" }], select: { id: true } });
  const groupe = await PDFDocument.create();
  groupe.setTitle(`Factures (${factures.length})`);
  groupe.setProducer(APP_NAME);
  for (const { id } of factures) {
    const r = await pdfFacture(id);
    if (!r) continue;
    const doc = await PDFDocument.load(r.pdf);
    for (const p of await groupe.copyPages(doc, doc.getPageIndices())) groupe.addPage(p);
  }
  return groupe.save();
}
