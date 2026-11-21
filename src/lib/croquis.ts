// Schéma du véhicule vu de dessus (avant à droite), dessiné à l'écran (SVG) et sur le PDF avec les mêmes formes.
// Repère : 400 × 200, origine en haut à gauche.

export const CROQUIS_L = 400;
export const CROQUIS_H = 200;

export type Forme =
  | { type: "rect"; x: number; y: number; l: number; h: number; r?: number; plein?: boolean }
  | { type: "ligne"; x1: number; y1: number; x2: number; y2: number };

/** Silhouette : roues, caisse, capot, pare-brise, toit, lunette, rétroviseurs, feux. */
export const FORMES_CROQUIS: Forme[] = [
  // Roues (dépassent de la caisse)
  { type: "rect", x: 78, y: 22, l: 48, h: 16, r: 4, plein: true },
  { type: "rect", x: 78, y: 162, l: 48, h: 16, r: 4, plein: true },
  { type: "rect", x: 282, y: 22, l: 48, h: 16, r: 4, plein: true },
  { type: "rect", x: 282, y: 162, l: 48, h: 16, r: 4, plein: true },
  // Caisse
  { type: "rect", x: 30, y: 32, l: 340, h: 136, r: 34 },
  // Capot (avant, à droite) et coffre (arrière, à gauche)
  { type: "ligne", x1: 300, y1: 40, x2: 300, y2: 160 },
  { type: "ligne", x1: 82, y1: 40, x2: 82, y2: 160 },
  // Pare-brise et lunette arrière
  { type: "rect", x: 252, y: 48, l: 30, h: 104, r: 8 },
  { type: "rect", x: 98, y: 52, l: 24, h: 96, r: 8 },
  // Toit
  { type: "rect", x: 130, y: 56, l: 114, h: 88, r: 6 },
  // Portières (séparations)
  { type: "ligne", x1: 190, y1: 32, x2: 190, y2: 56 },
  { type: "ligne", x1: 190, y1: 144, x2: 190, y2: 168 },
  // Rétroviseurs
  { type: "rect", x: 240, y: 20, l: 12, h: 12, r: 3 },
  { type: "rect", x: 240, y: 168, l: 12, h: 12, r: 3 },
  // Phares (avant) et feux (arrière)
  { type: "rect", x: 352, y: 46, l: 12, h: 22, r: 4 },
  { type: "rect", x: 352, y: 132, l: 12, h: 22, r: 4 },
  { type: "rect", x: 36, y: 46, l: 8, h: 22, r: 3 },
  { type: "rect", x: 36, y: 132, l: 8, h: 22, r: 3 },
];

/** Libellés de repère. */
export const REPERES_CROQUIS = [
  { texte: "AVANT", x: 386, y: 100, rotation: 90 },
  { texte: "ARRIÈRE", x: 14, y: 100, rotation: -90 },
] as const;
