import { z } from "zod";

/** Contrôle de clé IBAN (ISO 13616, modulo 97). */
export function ibanValide(iban: string): boolean {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearrange = s.slice(4) + s.slice(0, 4);
  let reste = 0;
  for (const c of rearrange) {
    const v = c >= "A" ? String(c.charCodeAt(0) - 55) : c;
    for (const d of v) reste = (reste * 10 + Number(d)) % 97;
  }
  return reste === 1;
}

const compact = (s: string) => s.replace(/\s/g, "").toUpperCase();

export const banqueSchema = z.object({
  iban: z
    .string()
    .trim()
    .max(50)
    .transform(compact)
    .refine((v) => v === "" || ibanValide(v), "IBAN invalide (vérifiez la saisie)"),
  bic: z
    .string()
    .trim()
    .max(20)
    .transform(compact)
    .refine((v) => v === "" || /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v), "BIC invalide (8 ou 11 caractères)"),
});

export const pointControleSchema = z.object({
  libelle: z.string().trim().min(2, "Libellé trop court").max(120),
});

export const pointControleUpdateSchema = z.object({
  libelle: z.string().trim().min(2, "Libellé trop court").max(120).optional(),
  isActive: z.boolean().optional(),
  /** Déplacement dans la liste. */
  deplacer: z.enum(["haut", "bas"]).optional(),
});

export const ficheSaisieSchema = z.object({
  points: z.array(z.object({ id: z.string().min(1).max(40), resultat: z.enum(["NON_VERIFIE", "OK", "A_SURVEILLER", "DEFAUT"]) })).max(100),
  remarques: z.string().trim().max(2000),
  valider: z.boolean(),
});

/** Coordonnées du garage (onglet « Mon Garage ») : reprises dans l'en-tête et le pied de page des PDF. */
export const garageSchema = z.object({
  nomGarage: z.string().trim().min(2, "Le nom du garage est requis").max(120),
  adresse: z.string().trim().min(5, "L'adresse est requise").max(200),
  telephone: z.string().trim().min(6, "Téléphone invalide").max(30),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(120),
  siret: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => /^\d{14}$/.test(v), "Le SIRET compte 14 chiffres"),
  tvaNumber: z
    .string()
    .trim()
    .max(20)
    .transform(compact)
    .refine((v) => v === "" || /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v), "N° de TVA invalide (ex. FR12345678901)"),
  formeJuridique: z.string().trim().max(40).optional().default(""),
  capitalSocial: z.string().trim().max(40).optional().default(""),
  rcs: z.string().trim().max(80).optional().default(""),
});

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
export type Jour = (typeof JOURS)[number];

/** Horaires d'ouverture : texte libre par jour (« 08:00-12:00 / 14:00-18:00 », « fermé »). */
export const horairesSchema = z.object(Object.fromEntries(JOURS.map((j) => [j, z.string().trim().max(60, "60 caractères maximum")])) as Record<Jour, z.ZodString>);
export type Horaires = z.infer<typeof horairesSchema>;

/** Lecture tolérante du JSON stocké (jours manquants : chaîne vide). */
export function lireHoraires(v: unknown): Horaires {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return Object.fromEntries(JOURS.map((j) => [j, typeof o[j] === "string" ? (o[j] as string) : ""])) as Horaires;
}

const modeleEmail = z.object({ sujet: z.string().max(150, "150 caractères maximum"), corps: z.string().max(4000, "4 000 caractères maximum") });
/** Modèles d'e-mails modifiables (« Mon Garage »). */
export const modelesEmailSchema = z.object({ vehiculePret: modeleEmail, rappelRdv: modeleEmail });
export type ModelesEmailInput = z.infer<typeof modelesEmailSchema>;
