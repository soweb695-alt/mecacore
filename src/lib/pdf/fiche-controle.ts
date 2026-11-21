import "server-only";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { APP_NAME } from "@/lib/app";
import { db } from "@/lib/db";
import { CROQUIS_H, CROQUIS_L, FORMES_CROQUIS, REPERES_CROQUIS } from "@/lib/croquis";
import { COLONNES, COLONNES_ANCIEN, grouperParCategorie, LIBELLE_NON_CONCERNE, lireDommages, type Resultat, type TypeStatuts } from "@/lib/fiche-controle";
import { safe } from "@/lib/pdf/document";
import { garagePdf } from "@/lib/pdf/lignes";
import { obtenirFiche, signaturesFiche } from "@/lib/services/fiche-controle";

const NOIR = rgb(0.08, 0.09, 0.12);
const GRIS = rgb(0.34, 0.38, 0.44);
const BORD = rgb(0.55, 0.58, 0.63);
const FOND = rgb(0.93, 0.94, 0.96);
const ROUGE = rgb(0.85, 0.18, 0.13);

const W = 595.28;
const H = 841.89;
const M = 34;

/** Rectangle à coins arrondis en chemin SVG (repère du croquis, y vers le bas). */
function rectArrondi(x: number, y: number, l: number, h: number, r: number): string {
  const rr = Math.min(r, l / 2, h / 2);
  return `M ${x + rr} ${y} H ${x + l - rr} Q ${x + l} ${y} ${x + l} ${y + rr} V ${y + h - rr} Q ${x + l} ${y + h} ${x + l - rr} ${y + h} H ${x + rr} Q ${x} ${y + h} ${x} ${y + h - rr} V ${y + rr} Q ${x} ${y} ${x + rr} ${y} Z`;
}

const date = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short" }).format(d);

/**
 * PDF « Fiche de contrôle du véhicule », façon formulaire papier : en-tête du garage (logo, coordonnées),
 * bloc véhicule, tableaux par catégorie avec colonnes de statut cochées d'une croix, croquis, observations et signatures.
 */
export async function pdfFicheControle(ordreId: string): Promise<{ numero: string; pdf: Uint8Array } | null> {
  const o = await db.ordreReparation.findUnique({
    where: { id: ordreId },
    select: { numero: true, kilometrage: true, devis: { select: { kilometrage: true, vehicule: { select: { marque: true, modele: true, immatriculation: true, kilometrage: true } } } } },
  });
  const garage = await garagePdf();
  if (!o || !garage) return null;
  const fiche = await obtenirFiche(ordreId);
  const signatures = await signaturesFiche(fiche.id);
  const v = o.devis.vehicule;
  const km = o.kilometrage ?? o.devis.kilometrage ?? v?.kilometrage ?? null;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fiche de contrôle ${o.numero}`);
  pdf.setProducer(APP_NAME);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([W, H]);

  const text = (p: PDFPage, t: string, x: number, y: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; right?: number; center?: number } = {}) => {
    const f = o.f ?? font;
    const size = o.size ?? 8.5;
    const s = safe(t);
    const w = f.widthOfTextAtSize(s, size);
    const xx = o.right !== undefined ? o.right - w : o.center !== undefined ? o.center - w / 2 : x;
    p.drawText(s, { x: xx, y, size, font: f, color: o.color ?? NOIR });
  };
  const cadre = (p: PDFPage, x: number, y: number, l: number, h: number, fond?: ReturnType<typeof rgb>) =>
    p.drawRectangle({ x, y, width: l, height: h, borderColor: BORD, borderWidth: 0.7, ...(fond ? { color: fond } : {}) });
  const croix = (p: PDFPage, cx: number, cy: number, r: number, color = NOIR, epaisseur = 1.2) => {
    p.drawLine({ start: { x: cx - r, y: cy - r }, end: { x: cx + r, y: cy + r }, thickness: epaisseur, color });
    p.drawLine({ start: { x: cx - r, y: cy + r }, end: { x: cx + r, y: cy - r }, thickness: epaisseur, color });
  };
  const tronquer = (t: string, f: PDFFont, size: number, max: number) => {
    let s = safe(t);
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1);
    return s === safe(t) ? s : `${s.slice(0, -1)}…`;
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
      out.push(cur);
    }
    return out;
  };

  // ---------- En-tête : logo et coordonnées du garage, titre ----------
  let y = H - M;
  let gx = M;
  if (garage.logo) {
    try {
      const img = garage.logo.format === "png" ? await pdf.embedPng(garage.logo.bytes) : await pdf.embedJpg(garage.logo.bytes);
      const k = Math.min(100 / img.width, 46 / img.height, 1);
      page.drawImage(img, { x: M, y: y - img.height * k, width: img.width * k, height: img.height * k });
      gx = M + img.width * k + 10;
    } catch {
      // Logo illisible : en-tête sans logo.
    }
  }
  text(page, garage.nom, gx, y - 11, { size: 12, f: bold });
  text(page, garage.adresse, gx, y - 24, { color: GRIS });
  text(page, `${garage.telephone} · ${garage.email}`, gx, y - 35, { color: GRIS });
  text(page, "FICHE DE CONTRÔLE", 0, y - 13, { size: 16, f: bold, right: W - M });
  text(page, "DU VÉHICULE", 0, y - 29, { size: 16, f: bold, right: W - M });
  text(page, `Ordre de réparation ${o.numero}`, 0, y - 42, { color: GRIS, right: W - M });
  y -= 60;

  // ---------- Bloc véhicule : Date, Immatriculation, Marque, Kilométrage ----------
  const infos: [string, string][] = [
    ["Date", date(fiche.valideeLe ?? fiche.createdAt)],
    ["Immatriculation", v?.immatriculation ?? ""],
    ["Marque", v ? `${v.marque} ${v.modele}` : ""],
    ["Kilométrage", km != null ? `${km.toLocaleString("fr-FR")} km` : ""],
  ];
  const li = (W - 2 * M) / 4;
  infos.forEach(([k, val], i) => {
    cadre(page, M + i * li, y - 30, li, 30);
    text(page, k.toUpperCase(), M + i * li + 6, y - 10, { size: 6.5, f: bold, color: GRIS });
    text(page, tronquer(val || " ", bold, 9.5, li - 12), M + i * li + 6, y - 24, { size: 9.5, f: bold });
  });
  y -= 44;

  // ---------- Tableaux par catégorie, en deux colonnes ----------
  const groupes =
    fiche.version >= 2
      ? grouperParCategorie(fiche.points.map((p) => ({ ...p, typeStatuts: p.typeStatuts as TypeStatuts | null, resultat: p.resultat as Resultat })))
      : [{ categorie: "Points de contrôle", typeStatuts: null as TypeStatuts | null, points: fiche.points.map((p) => ({ ...p, resultat: p.resultat as Resultat })) }];
  const GAP = 14;
  const LC = (W - 2 * M - GAP) / 2;
  const HL = 13.5; // hauteur d'une ligne
  const COL = 42; // largeur d'une colonne de statut
  const hauteurTable = (n: number) => 16 + HL + n * HL + 10;
  // Répartition : chaque catégorie va dans la colonne la moins remplie.
  const colonnesY = [y, y];
  const placements = groupes.map((g) => {
    const c = colonnesY[0] >= colonnesY[1] ? 0 : 1;
    const top = colonnesY[c];
    colonnesY[c] -= hauteurTable(g.points.length);
    return { g, x: M + c * (LC + GAP), top };
  });
  // Trop long pour une page (modèle très étendu) : les tableaux continuent en pleine largeur sur les pages suivantes.
  const tropLong = Math.min(...colonnesY) < 330;
  let yFlux = y;
  for (const { g, x: xCol, top } of placements) {
    const cols = g.typeStatuts ? COLONNES[g.typeStatuts] : COLONNES_ANCIEN;
    const avecNA = g.typeStatuts !== null && g.typeStatuts !== "CASE";
    const entetes = [...cols.map((c) => c.libelle), ...(avecNA ? [LIBELLE_NON_CONCERNE] : [])];
    const largeur = tropLong ? W - 2 * M : LC;
    const x = tropLong ? M : xCol;
    let ty = tropLong ? yFlux : top;
    if (tropLong && ty - hauteurTable(Math.min(g.points.length, 3)) < 60) {
      page = pdf.addPage([W, H]);
      ty = H - M;
    }
    const lLib = largeur - entetes.length * COL;
    // Titre de la catégorie
    text(page, g.categorie.toUpperCase(), x, ty - 10, { size: 8, f: bold });
    ty -= 16;
    // Ligne d'en-tête : « Élément » + colonnes de statut
    cadre(page, x, ty - HL, lLib, HL, FOND);
    text(page, "Élément", x + 5, ty - HL + 4, { size: 7.5, f: bold, color: GRIS });
    entetes.forEach((e, i) => {
      cadre(page, x + lLib + i * COL, ty - HL, COL, HL, FOND);
      text(page, e, 0, ty - HL + 4, { size: 7.5, f: bold, color: GRIS, center: x + lLib + i * COL + COL / 2 });
    });
    ty -= HL;
    for (const p of g.points) {
      if (tropLong && ty - HL < 50) {
        page = pdf.addPage([W, H]);
        ty = H - M;
      }
      cadre(page, x, ty - HL, lLib, HL);
      text(page, tronquer(p.libelle, font, 8, lLib - 10), x + 5, ty - HL + 4, { size: 8 });
      const valeurs = [...cols.map((c) => c.valeur), ...(avecNA ? (["NON_CONCERNE"] as Resultat[]) : [])];
      valeurs.forEach((val, i) => {
        const cx = x + lLib + i * COL;
        cadre(page, cx, ty - HL, COL, HL);
        if (p.resultat === val) croix(page, cx + COL / 2, ty - HL / 2, 3.2);
      });
      ty -= HL;
    }
    yFlux = ty - 10;
  }
  y = tropLong ? yFlux : Math.min(...colonnesY);

  // ---------- Croquis (à gauche) et observations (à droite) ----------
  const hBloc = 150;
  if (y - hBloc - 120 < M) {
    page = pdf.addPage([W, H]);
    y = H - M;
  }
  const avecCroquis = fiche.version >= 2;
  const lCroquis = avecCroquis ? LC : 0;
  if (avecCroquis) {
    text(page, "CROQUIS : ENDROITS ABÎMÉS (X)", M, y - 10, { size: 8, f: bold });
    cadre(page, M, y - 16 - hBloc + 16, LC, hBloc - 16);
    const k = Math.min((LC - 20) / CROQUIS_L, (hBloc - 36) / CROQUIS_H);
    const ox = M + (LC - CROQUIS_L * k) / 2;
    const oy = y - 16 - 10; // haut du dessin
    const px = (vx: number) => ox + vx * k;
    const py = (vy: number) => oy - vy * k;
    // Mêmes formes qu'à l'écran, tracées en chemins SVG (coins arrondis) dans le repère du croquis.
    for (const f of FORMES_CROQUIS) {
      if (f.type === "rect") page.drawSvgPath(rectArrondi(f.x, f.y, f.l, f.h, f.r ?? 0), { x: ox, y: oy, scale: k, borderColor: GRIS, borderWidth: 0.8 / k, ...(f.plein ? { color: FOND } : {}) });
      else page.drawLine({ start: { x: px(f.x1), y: py(f.y1) }, end: { x: px(f.x2), y: py(f.y2) }, thickness: 0.8, color: GRIS });
    }
    for (const r of REPERES_CROQUIS) {
      const s = safe(r.texte);
      const wt = font.widthOfTextAtSize(s, 6);
      // Texte vertical centré sur le repère : « AVANT » se lit de haut en bas, « ARRIÈRE » de bas en haut.
      if (r.rotation > 0) page.drawText(s, { x: px(r.x) - 3, y: py(r.y) + wt / 2, size: 6, font, color: GRIS, rotate: degrees(-90) });
      else page.drawText(s, { x: px(r.x) + 3, y: py(r.y) - wt / 2, size: 6, font, color: GRIS, rotate: degrees(90) });
    }
    for (const d of lireDommages(fiche.dommages)) croix(page, px(d.x * CROQUIS_L), py(d.y * CROQUIS_H), 4, ROUGE, 1.6);
  }
  const xObs = avecCroquis ? M + lCroquis + GAP : M;
  const lObs = avecCroquis ? LC : W - 2 * M;
  text(page, "OBSERVATIONS", xObs, y - 10, { size: 8, f: bold });
  cadre(page, xObs, y - hBloc, lObs, hBloc - 16);
  // Lignes d'écriture, comme sur le papier, puis le texte saisi.
  for (let ly = y - 16 - 16; ly > y - hBloc + 4; ly -= 16) page.drawLine({ start: { x: xObs + 6, y: ly }, end: { x: xObs + lObs - 6, y: ly }, thickness: 0.3, color: FOND });
  wrap(fiche.remarques ?? "", font, 8.5, lObs - 14)
    .slice(0, 8)
    .forEach((l, i) => text(page, l, xObs + 7, y - 16 - 12 - i * 16, { size: 8.5 }));
  y -= hBloc + 14;

  // ---------- Signatures ----------
  const hSig = 92;
  const blocs: { titre: string; nom: string; date: string | null; image: Uint8Array | null }[] = [
    {
      titre: "Nom, prénom et signature de l'examinant",
      nom: [fiche.examinantPrenom, fiche.examinantNom].filter(Boolean).join(" "),
      date: fiche.valideeLe ? date(fiche.valideeLe) : null,
      image: signatures?.examinantSignature ?? null,
    },
    { titre: "Vérification du responsable", nom: fiche.responsableNom ?? "", date: fiche.verifieeLe ? date(fiche.verifieeLe) : null, image: signatures?.responsableSignature ?? null },
  ];
  for (const [i, b] of blocs.entries()) {
    const x = M + i * (LC + GAP);
    cadre(page, x, y - hSig, LC, hSig);
    page.drawRectangle({ x, y: y - 15, width: LC, height: 15, color: FOND, borderColor: BORD, borderWidth: 0.7 });
    text(page, b.titre, x + 6, y - 11, { size: 7.5, f: bold, color: GRIS });
    text(page, b.nom ? `Nom : ${b.nom}` : "Nom :", x + 6, y - 28, { size: 8.5 });
    if (b.date) text(page, `Le ${b.date}`, 0, y - 28, { size: 8.5, color: GRIS, right: x + LC - 6 });
    if (b.image) {
      try {
        const img: PDFImage = await pdf.embedPng(b.image);
        const k = Math.min((LC - 20) / img.width, (hSig - 40) / img.height, 1);
        page.drawImage(img, { x: x + (LC - img.width * k) / 2, y: y - hSig + 5, width: img.width * k, height: img.height * k });
      } catch {
        // Signature illisible : cadre vide, à signer à la main.
      }
    }
  }

  // Pied de page
  pdf.getPages().forEach((p, i, all) => {
    text(p, [garage.nom, garage.mentions, `SIRET ${garage.siret}`].filter(Boolean).join(" · "), M, 22, { size: 7, color: GRIS });
    text(p, `Page ${i + 1}/${all.length}`, 0, 22, { size: 7, color: GRIS, right: W - M });
  });

  return { numero: o.numero, pdf: await pdf.save() };
}
