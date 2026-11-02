// Génère les icônes PWA (PNG) et le favicon à partir de public/icon.svg, avec le Chromium de Playwright.
// Usage : npm run icons   (à relancer après toute modification du logo)
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** Icône carrée : pictogramme centré sur fond uni ; `marge` = part vide de chaque côté (zone de sécurité). */
const ICONES = [
  { fichier: "public/icons/icon-192.png", taille: 192, fond: "#FFFFFF", marge: 0.06 },
  { fichier: "public/icons/icon-512.png", taille: 512, fond: "#FFFFFF", marge: 0.06 },
  // Masquable : le système peut rogner jusqu'à 20 % de chaque côté, le pictogramme reste dans le cercle central.
  { fichier: "public/icons/icon-maskable-512.png", taille: 512, fond: "#FFFFFF", marge: 0.2 },
  { fichier: "public/icons/apple-touch-icon.png", taille: 180, fond: "#FFFFFF", marge: 0.1 },
  // Tailles du favicon : assemblées dans src/app/favicon.ico, pas écrites séparément.
  { fichier: null, taille: 32, fond: null, marge: 0 },
  { fichier: null, taille: 48, fond: null, marge: 0 },
];

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
const pngs = {};
for (const i of ICONES) {
  await page.setViewportSize({ width: i.taille, height: i.taille });
  const cote = Math.round(i.taille * (1 - 2 * i.marge));
  await page.setContent(
    `<html><body style="margin:0;width:${i.taille}px;height:${i.taille}px;display:grid;place-items:center;background:${i.fond ?? "transparent"}">` +
      `<img src="${dataUrl}" style="width:${cote}px;height:${cote}px"></body></html>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  const png = await page.screenshot({ omitBackground: !i.fond, type: "png" });
  pngs[i.taille] = png;
  if (!i.fichier) continue;
  await writeFile(new URL(`../${i.fichier}`, import.meta.url), png);
  console.log(`✓ ${i.fichier}`);
}
await navigateur.close();

// favicon.ico : conteneur ICO avec deux images PNG (32 et 48 px), lu par tous les navigateurs.
const images = [pngs[32], pngs[48]];
const entete = Buffer.alloc(6 + 16 * images.length);
entete.writeUInt16LE(0, 0);
entete.writeUInt16LE(1, 2);
entete.writeUInt16LE(images.length, 4);
let decalage = entete.length;
images.forEach((png, k) => {
  const taille = [32, 48][k];
  const o = 6 + 16 * k;
  entete.writeUInt8(taille, o);
  entete.writeUInt8(taille, o + 1);
  entete.writeUInt16LE(1, o + 4);
  entete.writeUInt16LE(32, o + 6);
  entete.writeUInt32LE(png.length, o + 8);
  entete.writeUInt32LE(decalage, o + 12);
  decalage += png.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([entete, ...images]));
console.log("✓ src/app/favicon.ico");
