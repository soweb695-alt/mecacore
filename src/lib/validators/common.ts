import { z } from "zod";

/** Chaîne optionnelle : "" accepté (champ vide d'un formulaire). */
export const optStr = (max: number) => z.string().trim().max(max, `${max} caractères maximum`).optional();

export const optEmail = z
  .union([z.literal(""), z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254)])
  .optional();

export const optPhone = z
  .union([z.literal(""), z.string().trim().regex(/^[0-9+().\s-]{6,20}$/, "Numéro de téléphone invalide")])
  .optional();

export const idStr = z.string().min(1).max(40);

/** "" ou undefined → null, sinon la valeur nettoyée. */
export function nn<T extends string | undefined | null>(v: T): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}
