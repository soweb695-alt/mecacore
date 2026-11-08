import { APP_NAME } from "@/lib/app";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfLigne {
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  tvaRate: number;
  totalHT: number;
  /** Unité de la quantité (ex. « h » pour la main d'œuvre : le prix unitaire devient un taux horaire). */
  unite?: string;
  /** Mentions discrètes sous la désignation (référence, temps et taux horaire, pièces d'un forfait, remise…). */
  detail?: string | string[];
}

export interface PdfDocData {
  titre: string; // "Devis" | "Facture"
  numero: string;
  dateEmission: Date;
  dateSecondaire?: { label: string; date: Date };
  garage: { nom: string; adresse: string; telephone: string; email: string; siret: string; tva: string; logo?: { bytes: Uint8Array; format: "png" | "jpg" } };
  client: { nom: string; adresse?: string | null; email?: string | null; siret?: string | null };
  /** Mentions obligatoires de la réparation automobile : véhicule, immatriculation, kilométrage. */
  vehicule?: { libelle: string; immatriculation: string; kilometrage: number | null } | null;
  lignes: PdfLigne[];
  totaux: { totalHT: number; totalTVA: number; totalTTC: number };
  remisePro?: number;
  /** Montant HT de la remise professionnelle déjà déduite des prix. */
  remiseMontant?: number;
  notes?: string[];
  paiement?: { paye: number; reste: number };
  /** Remise globale sur la facture : tracée ligne à ligne dans le bloc des totaux. */
  remiseGlobale?: { libelle: string; montant: number; totalHTAvantRemise: number };
  /** Coordonnées bancaires du garage, affichées pour un règlement par virement. */
  virement?: { iban: string; bic: string; titulaire: string };
  /** Document de remise (bon de livraison) : ni prix, ni TVA, ni totaux. */
  sansPrix?: boolean;
  /** Devis : colonnes « PU TTC » et « Total TTC » par ligne (le PU HT reste affiché, les totaux HT / TVA / TTC aussi). */
  prixTTC?: boolean;
}

/** Prix TTC d'un montant HT, arrondi au centime. */
const ttc = (ht: number, taux: number) => Math.round(ht * (100 + taux)) / 100;

/** Les polices standard PDF n'encodent que le Latin-1 : on normalise espaces fines et caractères hors jeu. */
const safe = (s: string) =>
  s
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/[^\x20-\x7E -ÿ€]/g, "?");

const eur = (n: number) => safe(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n));
const date = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short" }).format(d);
const nombre = (n: number) => safe(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n));

const BLEU = rgb(0.114, 0.373, 0.82);
const GRIS = rgb(0.34, 0.38, 0.44);
const LIGNE = rgb(0.89, 0.9, 0.93);

export async function genererPdf(d: PdfDocData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.titre} ${d.numero}`);
  pdf.setProducer(APP_NAME);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 40;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (p: PDFPage, t: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: number } = {}) => {
    const f = o.font ?? font;
    const size = o.size ?? 9;
    const s = safe(t);
    const xx = o.right !== undefined ? o.right - f.widthOfTextAtSize(s, size) : x;
    p.drawText(s, { x: xx, y: yy, size, font: f, color: o.color ?? rgb(0.08, 0.09, 0.12) });
  };
  const wrap = (t: string, f: PDFFont, size: number, max: number): string[] => {
    const out: string[] = [];
    let cur = "";
    for (const w of safe(t).split(/\s+/)) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > max && cur) {
        out.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  };

  // En-tête : logo (onglet « Mon Garage ») à gauche des coordonnées, mis à l'échelle dans 110 × 48 pt.
  let gx = M;
  if (d.garage.logo) {
    try {
      const img = d.garage.logo.format === "png" ? await pdf.embedPng(d.garage.logo.bytes) : await pdf.embedJpg(d.garage.logo.bytes);
      const k = Math.min(110 / img.width, 48 / img.height, 1);
      page.drawImage(img, { x: M, y: y - img.height * k + 2, width: img.width * k, height: img.height * k });
      gx = M + img.width * k + 12;
    } catch {
      // Image illisible : en-tête sans logo plutôt qu'un PDF en erreur.
    }
  }
  text(page, d.garage.nom, gx, y - 12, { size: 15, font: bold, color: BLEU });
  text(page, d.garage.adresse, gx, y - 26, { color: GRIS });
  text(page, `${d.garage.telephone} · ${d.garage.email}`, gx, y - 38, { color: GRIS });
  text(page, d.titre.toUpperCase(), 0, y - 12, { size: 20, font: bold, right: W - M });
  text(page, `N° ${d.numero}`, 0, y - 28, { font: bold, right: W - M });
  text(page, `Date : ${date(d.dateEmission)}`, 0, y - 40, { right: W - M, color: GRIS });
  if (d.dateSecondaire) text(page, `${d.dateSecondaire.label} : ${date(d.dateSecondaire.date)}`, 0, y - 52, { right: W - M, color: GRIS });
  y -= 78;

  // Bloc client
  page.drawRectangle({ x: W / 2, y: y - 62, width: W / 2 - M, height: 66, borderColor: LIGNE, borderWidth: 1 });
  text(page, d.client.nom, W / 2 + 10, y - 12, { font: bold, size: 10 });
  let cy = y - 25;
  for (const l of [d.client.adresse, d.client.email, d.client.siret ? `SIRET ${d.client.siret}` : null].filter(Boolean) as string[]) {
    text(page, l, W / 2 + 10, cy, { color: GRIS });
    cy -= 11;
  }
  if (d.vehicule) {
    text(page, `Véhicule : ${d.vehicule.libelle}`, M, y - 12, { font: bold });
    text(page, `Immatriculation : ${d.vehicule.immatriculation}`, M, y - 25);
    text(page, `Kilométrage : ${d.vehicule.kilometrage != null ? `${nombre(d.vehicule.kilometrage)} km` : "non relevé"}`, M, y - 38);
  }
  y -= 85;

  // Tableau
  // Colonnes (bord droit de chaque valeur). Avec les prix TTC, la désignation est plus étroite.
  const cols = d.prixTTC ? { des: M, qte: 290, pu: 350, tva: 385, puTTC: 450, tot: W - M } : { des: M, qte: 360, pu: 440, tva: 475, puTTC: 0, tot: W - M };
  const largeurDes = d.sansPrix ? 400 : d.prixTTC ? 215 : 270;
  const entete = () => {
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: rgb(0.945, 0.953, 0.965) });
    text(page, "Désignation", cols.des + 6, y, { font: bold, color: GRIS });
    if (d.sansPrix) {
      text(page, "Quantité", 0, y, { font: bold, color: GRIS, right: cols.tot });
    } else {
      text(page, "Qté", 0, y, { font: bold, color: GRIS, right: cols.qte });
      text(page, "PU HT", 0, y, { font: bold, color: GRIS, right: cols.pu });
      text(page, "TVA", 0, y, { font: bold, color: GRIS, right: cols.tva });
      if (d.prixTTC) text(page, "PU TTC", 0, y, { font: bold, color: GRIS, right: cols.puTTC });
      text(page, d.prixTTC ? "Total TTC" : "Total HT", 0, y, { font: bold, color: GRIS, right: cols.tot });
    }
    y -= 20;
  };
  entete();
  for (const l of d.lignes) {
    const lignes = wrap(l.designation, font, 9, largeurDes);
    const details = (Array.isArray(l.detail) ? l.detail : l.detail ? [l.detail] : []).flatMap((t) => wrap(t, font, 7.5, largeurDes));
    if (y - lignes.length * 11 - details.length * 9.5 < 170) {
      page = pdf.addPage([W, H]);
      y = H - M;
      entete();
    }
    lignes.forEach((t, i) => text(page, t, cols.des + 6, y - i * 11));
    details.forEach((t, i) => text(page, t, cols.des + 6, y - lignes.length * 11 - i * 9.5, { size: 7.5, color: GRIS }));
    const qte = `${nombre(l.quantite)}${l.unite ? ` ${l.unite}` : ""}`;
    if (d.sansPrix) {
      text(page, qte, 0, y, { right: cols.tot });
    } else {
      text(page, qte, 0, y, { right: cols.qte });
      text(page, `${eur(l.prixUnitaireHT)}${l.unite ? `/${l.unite}` : ""}`, 0, y, { right: cols.pu });
      text(page, `${nombre(l.tvaRate)} %`, 0, y, { right: cols.tva });
      if (d.prixTTC) {
        text(page, `${eur(ttc(l.prixUnitaireHT, l.tvaRate))}${l.unite ? `/${l.unite}` : ""}`, 0, y, { right: cols.puTTC });
        text(page, eur(ttc(l.totalHT, l.tvaRate)), 0, y, { right: cols.tot, font: bold });
      } else {
        text(page, eur(l.totalHT), 0, y, { right: cols.tot });
      }
    }
    y -= lignes.length * 11 + details.length * 9.5 + 4;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.5, color: LIGNE });
    y -= 6;
  }

  // Totaux
  if (y < 150) {
    page = pdf.addPage([W, H]);
    y = H - M;
  }
  y -= 8;
  const bx = W - M - 180;
  const ligneTotal = (label: string, v: string, b = false) => {
    text(page, label, bx, y, { font: b ? bold : font, size: b ? 11 : 9 });
    text(page, v, 0, y, { right: W - M, font: b ? bold : font, size: b ? 11 : 9 });
    y -= b ? 18 : 14;
  };
  if (!d.sansPrix) {
    if (d.remiseGlobale) {
      ligneTotal("Total HT avant remise", eur(d.remiseGlobale.totalHTAvantRemise));
      ligneTotal(d.remiseGlobale.libelle, `- ${eur(d.remiseGlobale.montant)}`);
    }
    ligneTotal("Total HT", eur(d.totaux.totalHT));
    ligneTotal("TVA", eur(d.totaux.totalTVA));
    ligneTotal("Total TTC", eur(d.totaux.totalTTC), true);
  }
  if (d.paiement && !d.sansPrix) {
    ligneTotal("Déjà réglé", eur(d.paiement.paye));
    ligneTotal("Reste à payer", eur(d.paiement.reste), true);
  }
  if (d.remisePro && d.remisePro > 0) {
    text(page, `Remise professionnelle de ${nombre(d.remisePro)} % déduite sur les pièces${d.remiseMontant ? ` (${eur(d.remiseMontant)} HT)` : ""}.`, M, y + 20, { color: GRIS });
  }
  if (d.virement) {
    y -= 6;
    if (y < 90) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
    text(page, "Règlement par virement bancaire", M, y, { font: bold, size: 9 });
    y -= 12;
    for (const l of [`Titulaire : ${d.virement.titulaire}`, `IBAN : ${d.virement.iban}`, `BIC : ${d.virement.bic}`, `Merci d'indiquer le numéro de facture ${d.numero} en référence.`]) {
      text(page, l, M, y, { size: 9 });
      y -= 11;
    }
    y -= 4;
  }
  for (const n of d.notes ?? []) {
    for (const l of wrap(n, font, 8, W - 2 * M)) {
      text(page, l, M, y, { size: 8, color: GRIS });
      y -= 10;
    }
  }

  // Pied de page
  pdf.getPages().forEach((p, i, all) => {
    text(p, `${d.garage.nom} · SIRET ${d.garage.siret} · TVA ${d.garage.tva}`, M, 28, { size: 7.5, color: GRIS });
    text(p, `Page ${i + 1}/${all.length}`, 0, 28, { size: 7.5, color: GRIS, right: W - M });
  });

  return pdf.save();
}
