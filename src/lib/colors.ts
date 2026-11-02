export const PALETTE = ["#1d5fd1", "#17803d", "#d18a00", "#8a3fd1", "#c2410c", "#0e7490", "#be185d", "#4d7c0f"] as const;

export const COULEUR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Couleur d'un collaborateur : celle qui lui est attribuée (#RRGGBB), sinon une couleur automatique
 * déterministe (même identifiant → même couleur, partout dans l'application).
 */
export function couleurCollaborateur(userId: string, couleur?: string | null): string {
  if (couleur && COULEUR_REGEX.test(couleur)) return couleur.toLowerCase();
  let h = 5381;
  for (let i = 0; i < userId.length; i++) h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
