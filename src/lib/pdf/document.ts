import { APP_NAME } from "@/lib/app";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

export interface PdfLigne {
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  tvaRate: number;
  totalHT: number;
  /** PU TTC et total TTC de la ligne (le TTC fait foi). Absents : déduits du HT. */
  prixUnitaireTTC?: number;
  totalTTC?: number;
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
  garage: { nom: string; adresse: string; telephone: string; email: string; siret: string; tva: string; mentions?: string; logo?: { bytes: Uint8Array; format: "png" | "jpg" } };
  client: { nom: string; adresse?: string | null; email?: string | null; siret?: string | null };
  /** Mentions obligatoires de la réparation automobile : véhicule, immatriculation, kilométrage. */
  vehicule?: { libelle: string; immatriculation: string; kilometrage: number | null } | null;
  lignes: PdfLigne[];
  totaux: { totalHT: number; totalTVA: number; totalTTC: number };
  remisePro?: number;
  /** Montant HT de la remise professionnelle déjà déduite des prix. */
  remiseMontant?: number;
  /** Remise PRO affichée « uniquement dans le total » : total HT brut puis ligne « Remise PRO » avant le total HT. */
  remiseProTotal?: { totalHTBrut: number; montant: number };
  notes?: string[];
  paiement?: { paye: number; reste: number };
  /** Remise globale sur la facture : tracée ligne à ligne dans le bloc des totaux. */
  remiseGlobale?: { libelle: string; montant: number; totalHTAvantRemise: number; /** Remise sur le TTC : total TTC avant remise affiché. */ totalTTCAvantRemise?: number };
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
export const safe = (s: string) =>
  s
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/[^\x20-\x7E -ÿ€]/g, "?");

const eur = (n: number) => safe(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n));
const date = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" }).format(d);
const nombre = (n: number) => safe(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n));

const W = 595.28;
const H = 841.89;
const M = 42;

const ACCENT = rgb(0.114, 0.373, 0.82); // bleu MecaCore, en touche discrète
const NOIR = rgb(0.09, 0.1, 0.13);
const GRIS = rgb(0.4, 0.43, 0.48);
const GRIS_CLAIR = rgb(0.62, 0.65, 0.7);
const FILET = rgb(0.86, 0.88, 0.91);
const VERT = rgb(0.06, 0.5, 0.28);

/**
 * Devis, factures et bons de livraison : mise en page « sobre » (noir et gris, filets fins, un trait d'accent bleu).
 * En-tête (logo, garage, titre), bloc client / véhicule / dates, tableau des lignes, totaux à droite,
 * virement à gauche, notes et mentions en bas, pied de page légal.
 */
export async function genererPdf(d: PdfDocData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.titre} ${d.numero}`);
  pdf.setProducer(APP_NAME);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([W, H]);

  const text = (p: PDFPage, t: string, x: number, y: number, o: { size?: number; f?: PDFFont; color?: RGB; right?: number; espacement?: number } = {}) => {
    const f = o.f ?? font;
    const size = o.size ?? 9;
    const s = safe(t);
    if (o.espacement) {
      // Petites capitales espacées (libellés de sections).
      let cx = x;
      for (const c of s) {
        p.drawText(c, { x: cx, y, size, font: f, color: o.color ?? NOIR });
        cx += f.widthOfTextAtSize(c, size) + o.espacement;
      }
      return;
    }
    const xx = o.right !== undefined ? o.right - f.widthOfTextAtSize(s, size) : x;
    p.drawText(s, { x: xx, y, size, font: f, color: o.color ?? NOIR });
  };
  const wrap = (t: string, f: PDFFont, size: number, max: number): string[] => {
    const out: string[] = [];
    for (const para of safe(t).split(/\n/)) {
      let cur = "";
      for (const w of para.split(/\s+/)) {
        const test = cur ? `${cur} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) > max && cur) {
          out.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur || out.length === 0) out.push(cur);
    }
    return out;
  };
  const libelle = (p: PDFPage, t: string, x: number, y: number) => text(p, t.toUpperCase(), x, y, { size: 7, f: bold, color: GRIS, espacement: 0.8 });

  // ================= En-tête : logo et garage à gauche, titre à droite, filet d'accent =================
  let y = H - M;
  let gx = M;
  if (d.garage.logo) {
    try {
      const logo = d.garage.logo.format === "png" ? await pdf.embedPng(d.garage.logo.bytes) : await pdf.embedJpg(d.garage.logo.bytes);
      const k = Math.min(90 / logo.width, 46 / logo.height, 1);
      page.drawImage(logo, { x: M, y: y - logo.height * k, width: logo.width * k, height: logo.height * k });
      gx = M + logo.width * k + 14;
    } catch {
      // Image illisible : en-tête sans logo plutôt qu'un PDF en erreur.
    }
  }
  text(page, d.garage.nom, gx, y - 12, { size: 12, f: bold });
  text(page, d.garage.adresse, gx, y - 26, { size: 8.5, color: GRIS });
  text(page, `${d.garage.telephone} · ${d.garage.email}`, gx, y - 37, { size: 8.5, color: GRIS });
  text(page, d.titre, 0, y - 20, { size: 26, right: W - M });
  text(page, `N° ${d.numero}`, 0, y - 36, { size: 9, color: GRIS, right: W - M });
  y -= 62;
  page.drawRectangle({ x: M, y, width: 36, height: 2.5, color: ACCENT });
  page.drawLine({ start: { x: M + 40, y: y + 1.25 }, end: { x: W - M, y: y + 1.25 }, thickness: 0.5, color: FILET });
  y -= 26;

  // ================= Client, véhicule, dates =================
  const lc = (W - 2 * M) / 3;
  libelle(page, d.titre.startsWith("Devis") ? "Établi pour" : d.sansPrix ? "Livré à" : "Facturé à", M, y);
  text(page, d.client.nom, M, y - 15, { size: 10, f: bold });
  [d.client.adresse, d.client.email, d.client.siret ? `SIRET ${d.client.siret}` : null]
    .filter((l): l is string => !!l)
    .flatMap((l) => wrap(l, font, 8.5, lc - 12))
    .slice(0, 4)
    .forEach((l, i) => text(page, l, M, y - 29 - i * 11, { size: 8.5, color: GRIS }));
  if (d.vehicule) {
    libelle(page, "Véhicule", M + lc, y);
    wrap(d.vehicule.libelle, bold, 10, lc - 12).slice(0, 1).forEach((l) => text(page, l, M + lc, y - 15, { size: 10, f: bold }));
    // Mentions obligatoires de la réparation automobile, écrites en toutes lettres.
    text(page, `Immatriculation : ${d.vehicule.immatriculation}`, M + lc, y - 29, { size: 8.5, color: GRIS });
    text(page, `Kilométrage : ${d.vehicule.kilometrage != null ? `${nombre(d.vehicule.kilometrage)} km` : "non relevé"}`, M + lc, y - 40, { size: 8.5, color: GRIS });
  }
  libelle(page, "Dates", M + 2 * lc, y);
  text(page, `Émis${d.titre.startsWith("Facture") ? "e" : ""} le ${date(d.dateEmission)}`, M + 2 * lc, y - 15, { size: 8.5 });
  if (d.dateSecondaire) text(page, `${d.dateSecondaire.label} : ${date(d.dateSecondaire.date)}`, M + 2 * lc, y - 27, { size: 8.5 });
  y -= 76;

  // ================= Tableau des lignes =================
  const ttcCols = !!d.prixTTC && !d.sansPrix;
  const cols = ttcCols ? { qte: M + 262, pu: M + 326, tva: M + 364, puTTC: M + 432, tot: W - M } : { qte: M + 300, pu: M + 375, tva: M + 420, puTTC: 0, tot: W - M };
  const largeurDes = d.sansPrix ? 400 : ttcCols ? 205 : 245;
  const entete = () => {
    libelle(page, "Désignation", M, y - 6);
    const h = { size: 7, f: bold, color: GRIS };
    if (d.sansPrix) {
      text(page, "QUANTITÉ", 0, y - 6, { ...h, right: cols.tot });
    } else {
      text(page, "QTÉ", 0, y - 6, { ...h, right: cols.qte });
      text(page, "PU HT", 0, y - 6, { ...h, right: cols.pu });
      text(page, "TVA", 0, y - 6, { ...h, right: cols.tva });
      if (ttcCols) text(page, "PU TTC", 0, y - 6, { ...h, right: cols.puTTC });
      text(page, ttcCols ? "TOTAL TTC" : "TOTAL HT", 0, y - 6, { ...h, right: cols.tot });
    }
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: NOIR });
    y -= 4;
  };
  entete();
  for (const l of d.lignes) {
    const des = wrap(l.designation, bold, 9, largeurDes);
    const details = (Array.isArray(l.detail) ? l.detail : l.detail ? [l.detail] : []).flatMap((t) => wrap(t, font, 7.5, largeurDes));
    const h = 8 + des.length * 11 + details.length * 9.5 + 6;
    if (y - h < 190) {
      page = pdf.addPage([W, H]);
      y = H - M;
      entete();
    }
    const yt = y - 12;
    des.forEach((t, k) => text(page, t, M, yt - k * 11, { size: 9, f: bold }));
    details.forEach((t, k) => text(page, t, M, yt - des.length * 11 - k * 9.5, { size: 7.5, color: GRIS }));
    const qte = `${nombre(l.quantite)}${l.unite ? ` ${l.unite}` : ""}`;
    if (d.sansPrix) {
      text(page, qte, 0, yt, { right: cols.tot, f: bold });
    } else {
      text(page, qte, 0, yt, { right: cols.qte });
      text(page, `${eur(l.prixUnitaireHT)}${l.unite ? `/${l.unite}` : ""}`, 0, yt, { right: cols.pu, color: GRIS });
      text(page, `${nombre(l.tvaRate)} %`, 0, yt, { right: cols.tva, color: GRIS });
      if (ttcCols) text(page, eur(l.prixUnitaireTTC ?? ttc(l.prixUnitaireHT, l.tvaRate)), 0, yt, { right: cols.puTTC });
      text(page, eur(ttcCols ? (l.totalTTC ?? ttc(l.totalHT, l.tvaRate)) : l.totalHT), 0, yt, { right: cols.tot, f: bold });
    }
    y -= h;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.4, color: FILET });
  }

  // ================= Totaux (à droite) et virement (à gauche) =================
  if (!d.sansPrix && y < 220) {
    page = pdf.addPage([W, H]);
    y = H - M;
  }
  y -= 16;
  const lT = 210;
  const xT = W - M - lT;
  const yTop = y;
  let ty = y;
  if (!d.sansPrix) {
    const lignes: [string, string][] = [];
    if (d.remiseProTotal) lignes.push(["Total HT brut", eur(d.remiseProTotal.totalHTBrut)], ["Remise PRO", `- ${eur(d.remiseProTotal.montant)}`]);
    if (d.remiseGlobale) {
      if (d.remiseGlobale.totalTTCAvantRemise !== undefined) lignes.push(["Total TTC avant remise", eur(d.remiseGlobale.totalTTCAvantRemise)]);
      else lignes.push(["Total HT avant remise", eur(d.remiseGlobale.totalHTAvantRemise)]);
      lignes.push([d.remiseGlobale.libelle, `- ${eur(d.remiseGlobale.montant)}`]);
    }
    lignes.push(["Total HT", eur(d.totaux.totalHT)], ["TVA", eur(d.totaux.totalTVA)]);
    for (const [l, v] of lignes) {
      text(page, l, xT, ty - 10, { size: 9, color: GRIS });
      text(page, v, 0, ty - 10, { size: 9, right: W - M });
      ty -= 16;
    }
    ty -= 4;
    page.drawLine({ start: { x: xT, y: ty }, end: { x: W - M, y: ty }, thickness: 0.8, color: NOIR });
    text(page, "Total TTC", xT, ty - 18, { size: 11, f: bold });
    text(page, eur(d.totaux.totalTTC), 0, ty - 18, { size: 13, f: bold, right: W - M });
    ty -= 28;
    if (d.paiement) {
      ty -= 8;
      text(page, "Déjà réglé", xT, ty - 10, { size: 9, color: GRIS });
      text(page, eur(d.paiement.paye), 0, ty - 10, { size: 9, right: W - M });
      ty -= 20;
      const solde = d.paiement.reste <= 0.004;
      text(page, solde ? "Facture acquittée" : "Reste à payer", xT, ty - 10, { size: 10, f: bold, color: solde ? VERT : NOIR });
      if (!solde) text(page, eur(d.paiement.reste), 0, ty - 10, { size: 11, f: bold, right: W - M });
      ty -= 20;
    }
    if (d.remisePro && d.remisePro > 0) {
      ty -= 4;
      for (const l of wrap(`Remise professionnelle de ${nombre(d.remisePro)} % déduite sur les pièces${d.remiseMontant ? ` (${eur(d.remiseMontant)} HT)` : ""}.`, font, 7.5, lT)) {
        text(page, l, xT, ty - 8, { size: 7.5, color: VERT });
        ty -= 10;
      }
    }
  }
  let gy = yTop;
  if (d.virement) {
    const hv = 78;
    page.drawRectangle({ x: M, y: gy - hv, width: 2, height: hv, color: ACCENT });
    const xv = M + 12;
    libelle(page, "Règlement par virement", xv, gy - 15);
    text(page, `Titulaire : ${d.virement.titulaire}`, xv, gy - 30, { size: 8.5 });
    text(page, `IBAN : ${d.virement.iban}`, xv, gy - 42, { size: 8.5, f: bold });
    text(page, `BIC : ${d.virement.bic}`, xv, gy - 54, { size: 8.5 });
    text(page, `Merci d'indiquer le numéro ${d.numero} en référence.`, xv, gy - 66, { size: 7.5, color: GRIS });
    gy -= hv + 14;
  }
  y = Math.min(ty, gy) - 18;

  // ================= Notes et mentions =================
  const notes = (d.notes ?? []).filter(Boolean);
  if (notes.length) {
    if (y < 110) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: FILET });
    y -= 14;
    for (const n of notes) {
      for (const l of wrap(n, font, 7.5, W - 2 * M)) {
        if (y < 50) {
          page = pdf.addPage([W, H]);
          y = H - M;
        }
        text(page, l, M, y, { size: 7.5, color: GRIS });
        y -= 10;
      }
      y -= 2;
    }
  }

  // Pied de page
  pdf.getPages().forEach((p, i, all) => {
    text(p, [d.garage.nom, d.garage.mentions, `SIRET ${d.garage.siret}`, `TVA ${d.garage.tva}`].filter(Boolean).join(" · "), M, 24, { size: 7, color: GRIS_CLAIR });
    text(p, `Page ${i + 1}/${all.length}`, 0, 24, { size: 7, color: GRIS_CLAIR, right: W - M });
  });

  return pdf.save();
}
