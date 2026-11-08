import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  ok: "bg-success-bg text-success",
  warn: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-destructive",
  info: "bg-info-bg text-info",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export const LABELS = {
  statutDevis: { BROUILLON: "Brouillon", ENVOYE: "Envoyé", VALIDE: "Validé", REJETE: "Rejeté" },
  statutOrdre: {
    EN_ATTENTE_SIGNATURE: "En attente de signature", SIGNE: "Signé", EN_COURS: "En cours", A_TRAITER_MAGASIN: "À traiter par le Magasin", FACTURE: "Facturé",
  },
  statutFacture: {
    BROUILLON: "Brouillon", EMISE: "Émise", PARTIELLEMENT_PAYEE: "Partiellement payée", PAYEE: "Payée", IMPAYEE: "Impayée", ANNULEE: "Annulée",
  },
  statutRdv: { PLANIFIE: "Planifié", CONFIRME: "Confirmé", HONORE: "Honoré", ANNULE: "Annulé", NO_SHOW: "Absent" },
  typeClient: { PARTICULIER: "Particulier", PRO: "Pro" },
  typeLigne: { MAIN_OEUVRE: "Main d'œuvre", FORFAIT: "Forfait", PIECE: "Pièce", FRAIS_DIVERS: "Frais divers" },
  mode: { CB: "Carte bancaire", ESPECES: "Espèces", CHEQUE: "Chèque", VIREMENT: "Virement", PLUSIEURS_FOIS: "Paiement en plusieurs fois" },
  typeTarif: { MO1: "Main d'œuvre 1", MO2: "Main d'œuvre 2", MO3: "Main d'œuvre 3", FORFAIT: "Forfait", FRAIS_DIVERS: "Frais divers" },
  statutBL: { EN_ATTENTE: "En attente", PRETE: "Prêt à être retiré", LIVREE: "Livré" },
  statutBC: { EN_ATTENTE: "En attente", RECEPTIONNEE_PARTIELLE: "Réception partielle", RECEPTIONNEE: "Réceptionnée" },
  role: { ADMIN: "Administrateur", SECRETARIAT: "Magasin", MECANICIEN: "Atelier" },
  typeRetour: { PIECE_DEPOSEE: "Pièce déposée / retour", CONSIGNE: "Consigne / échange standard" },
  statutRetour: { EN_ATTENTE: "En attente", RENVOYEE_FOURNISSEUR: "Renvoyée au fournisseur", REMBOURSEE: "Consigne remboursée", RENDUE_CLIENT: "Rendue au client", CLOTUREE: "Clôturée" },
} as const;

export const TONE_DEVIS: Record<string, Tone> = { BROUILLON: "neutral", ENVOYE: "info", VALIDE: "ok", REJETE: "danger" };
export const TONE_ORDRE: Record<string, Tone> = { EN_ATTENTE_SIGNATURE: "warn", SIGNE: "info", EN_COURS: "info", A_TRAITER_MAGASIN: "warn", FACTURE: "ok" };
export const TONE_FACTURE: Record<string, Tone> = { BROUILLON: "neutral", EMISE: "info", PARTIELLEMENT_PAYEE: "warn", PAYEE: "ok", IMPAYEE: "danger", ANNULEE: "neutral" };
export const TONE_RETOUR: Record<string, Tone> = { EN_ATTENTE: "warn", RENVOYEE_FOURNISSEUR: "info", REMBOURSEE: "ok", RENDUE_CLIENT: "ok", CLOTUREE: "neutral" };
export const TONE_RDV: Record<string, Tone> = { PLANIFIE: "info", CONFIRME: "ok", HONORE: "neutral", ANNULE: "neutral", NO_SHOW: "danger" };
