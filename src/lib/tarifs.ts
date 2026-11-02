/** Ordre d'affichage des tarifs : forfaits d'abord, puis main d'œuvre, puis frais divers. */
const RANG: Record<string, number> = { FORFAIT: 0, MO1: 1, MO2: 2, MO3: 3, FRAIS_DIVERS: 4 };

export const rangTarif = (type: string): number => RANG[type] ?? 99;

export function trierTarifs<T extends { type: string; libelle: string }>(tarifs: T[]): T[] {
  return [...tarifs].sort((a, b) => rangTarif(a.type) - rangTarif(b.type) || a.libelle.localeCompare(b.libelle, "fr"));
}
