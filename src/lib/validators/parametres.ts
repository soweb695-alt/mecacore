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
  /** Catégorie du modèle (fiche par catégories). */
  categorieId: z.string().min(1).max(40),
});

export const pointControleUpdateSchema = z.object({
  libelle: z.string().trim().min(2, "Libellé trop court").max(120).optional(),
  isActive: z.boolean().optional(),
  /** Déplacement dans la liste. */
  deplacer: z.enum(["haut", "bas"]).optional(),
});

const signaturePng = z.string().max(600_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Signature invalide");

/** Saisie de la fiche de contrôle par l'atelier ; à la validation, nom, prénom et signature de l'examinant sont exigés. */
export const ficheSaisieSchema = z
  .object({
    points: z.array(z.object({ id: z.string().min(1).max(40), resultat: z.enum(["NON_VERIFIE", "OK", "A_SURVEILLER", "DEFAUT", "ABIME", "NON_CONFORME", "A_REPARER", "NON_CONCERNE"]) })).max(200),
    remarques: z.string().trim().max(2000),
    /** Croquis : croix placées sur le schéma du véhicule (fractions 0 à 1). */
    dommages: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(40).optional(),
    valider: z.boolean(),
    examinant: z
      .object({
        nom: z.string().trim().min(1, "Nom de l'examinant requis").max(60),
        prenom: z.string().trim().min(1, "Prénom de l'examinant requis").max(60),
        /** Exigée à la validation seulement (un brouillon garde le nom et le prénom). */
        signature: signaturePng.optional(),
      })
      .optional(),
  })
  .refine((v) => !v.valider || v.examinant?.signature, { path: ["examinant"], message: "Nom, prénom et signature de l'examinant sont requis pour valider" });

/** Vérification de la fiche par le responsable (Magasin ou administrateur). */
export const ficheVerificationSchema = z.object({
  nom: z.string().trim().min(2, "Nom du responsable requis").max(80),
  signature: signaturePng,
});

export const categorieControleSchema = z.object({
  libelle: z.string().trim().min(2, "Libellé trop court").max(80),
  typeStatuts: z.enum(["OK_ABIME", "OK_NC", "OK_A_REPARER", "CASE"]),
});
export const categorieControleUpdateSchema = z.object({
  libelle: z.string().trim().min(2, "Libellé trop court").max(80).optional(),
  typeStatuts: z.enum(["OK_ABIME", "OK_NC", "OK_A_REPARER", "CASE"]).optional(),
  isActive: z.boolean().optional(),
  deplacer: z.enum(["haut", "bas"]).optional(),
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

// ---------- Paramètres › Facturation ----------

export const MODES_PAIEMENT = ["CB", "ESPECES", "CHEQUE", "VIREMENT", "PLUSIEURS_FOIS"] as const;
export type ModePaiementCle = (typeof MODES_PAIEMENT)[number];
export const LIBELLES_MODE: Record<ModePaiementCle, string> = { CB: "Carte bancaire", ESPECES: "Espèces", CHEQUE: "Chèque", VIREMENT: "Virement", PLUSIEURS_FOIS: "Paiement en plusieurs fois" };

/** Délais de paiement proposés (jours) ; 0 = paiement immédiat. */
export const DELAIS_PAIEMENT = [0, 15, 30, 45] as const;
export const libelleDelai = (j: number) => (j === 0 ? "Paiement immédiat" : `${j} jours`);

export const AFFICHAGES_REMISE = ["LIGNE", "TOTAL", "MASQUER"] as const;
export type AffichageRemiseCle = (typeof AFFICHAGES_REMISE)[number];
export const LIBELLES_AFFICHAGE_REMISE: Record<AffichageRemiseCle, string> = {
  LIGNE: "Afficher sur chaque ligne",
  TOTAL: "Afficher uniquement dans le total",
  MASQUER: "Masquer complètement",
};

/** Mentions imprimées sur les factures tant que le garage n'a pas saisi les siennes. */
export const MENTIONS_FACTURE_DEFAUT =
  "En cas de retard de paiement, une indemnité forfaitaire de 40 € pour frais de recouvrement sera exigible (art. L441-10 du Code de commerce), ainsi que des pénalités au taux de trois fois le taux d'intérêt légal. Pas d'escompte pour paiement anticipé.";

/** Mention imprimée au-dessus de la signature du client sur l'ordre de réparation, tant que le garage n'a pas saisi la sienne. */
export const MENTION_ACCORD_OR_DEFAUT =
  "Bon pour accord. J'autorise le garage à effectuer les travaux décrits ci-dessus et à procéder aux essais nécessaires.";

const prefixe = (nom: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, `Préfixe ${nom} : 1 à 10 lettres ou chiffres, sans espace`);

export const facturationSchema = z
  .object({
    modesPaiement: z.array(z.enum(MODES_PAIEMENT)).min(1, "Cochez au moins un mode de paiement").max(MODES_PAIEMENT.length),
    delaiPaiementDefaut: z.number().int().refine((v) => (DELAIS_PAIEMENT as readonly number[]).includes(v), "Délai de paiement invalide"),
    prefixDevis: prefixe("devis"),
    prefixFacture: prefixe("facture"),
    prefixBonLivraison: prefixe("bon de livraison"),
    mentionsFacture: z.string().trim().max(3000, "3 000 caractères maximum"),
    mentionAccordOR: z.string().trim().max(1000, "1 000 caractères maximum"),
    affichageRemise: z.enum(AFFICHAGES_REMISE),
  })
  .refine((v) => new Set([v.prefixDevis, v.prefixFacture, v.prefixBonLivraison]).size === 3, { path: ["prefixFacture"], message: "Les trois préfixes doivent être différents" });
export type FacturationInput = z.infer<typeof facturationSchema>;

// ---------- Paramètres › Communication ----------

export const communicationSchema = modelesEmailSchema.extend({
  expediteurNom: z.string().trim().max(70, "70 caractères maximum"),
  expediteurEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(120)]),
});
export type CommunicationInput = z.infer<typeof communicationSchema>;

// ---------- Paramètres › Stocks & alertes ----------

export const stockParametresSchema = z.object({
  seuilAlerteDefaut: z.number().int("Nombre entier requis").min(0, "Seuil invalide").max(100000),
});

export const categorieSchema = z.object({ libelle: z.string().trim().min(2, "Libellé trop court").max(60, "60 caractères maximum") });
export const categorieUpdateSchema = z.object({
  libelle: z.string().trim().min(2, "Libellé trop court").max(60, "60 caractères maximum").optional(),
  deplacer: z.enum(["haut", "bas"]).optional(),
});
