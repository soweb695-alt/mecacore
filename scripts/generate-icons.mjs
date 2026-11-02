// Génère les icônes PWA (192, 512, maskable, apple-touch) à partir d'un SVG de clé à molette.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const wrench = `<path d="M22 6a8 8 0 0 0-7.4 11L5 26.6a2.8 2.8 0 0 0 4 4L18.6 21A8 8 0 0 0 30 13.4l-4.6 4.6-4.4-1-1-4.4L24.6 7A8 8 0 0 0 22 6z" fill="#fff"/>`;
const svg = (pad, radius) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#1d5fd1"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 36})">${wrench}</g></svg>`;

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-512.png", 512, svg(110, 96)],
  ["icon-192.png", 192, svg(110, 96)],
  ["icon-maskable-512.png", 512, svg(150, 0)],
  ["apple-touch-icon.png", 180, svg(110, 0)],
];
for (const [name, size, s] of out) await sharp(Buffer.from(s)).resize(size, size).png().toFile(`public/icons/${name}`);
console.log("Icônes générées");
