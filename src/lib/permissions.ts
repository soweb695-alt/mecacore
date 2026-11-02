// Contrôle d'accès par rôle (RBAC). Module pur : utilisable côté API, serveur et UI.

export type Role = "ADMIN" | "SECRETARIAT" | "MECANICIEN";

export type Action = "read" | "create" | "update" | "delete" | "validate" | "export";

export type Resource =
  | "client"
  | "vehicule"
  | "piece"
  | "tarif"
  | "devis"
  | "ordre"
  | "photo"
  | "facture"
  | "paiement"
  | "rdv"
  | "bonCommande"
  | "bonLivraison"
  | "message"
  | "campagne"
  | "analyse"
  | "collaborateur"
  | "parametre"
  | "marge"
  | "prixAchat";

export interface PermissionUser {
  id: string;
  role: Role;
}

const ALL: Action[] = ["read", "create", "update", "delete", "validate", "export"];

const MATRIX: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: Object.fromEntries(
    (
      [
        "client", "vehicule", "piece", "tarif", "devis", "ordre", "photo", "facture",
        "paiement", "rdv", "bonCommande", "bonLivraison", "message", "campagne", "analyse", "collaborateur",
        "parametre", "marge", "prixAchat",
      ] as Resource[]
    ).map((r) => [r, ALL]),
  ),
  SECRETARIAT: {
    client: ["read", "create", "update"],
    vehicule: ["read", "create", "update"],
    piece: ["read", "create", "update", "export"],
    tarif: ["read"],
    devis: ["read", "create", "update", "validate"],
    ordre: ["read", "update"],
    photo: ["read"],
    facture: ["read", "create", "update", "export"],
    paiement: ["read", "create"],
    rdv: ["read", "create", "update", "delete"],
    bonCommande: ["read", "create", "update"],
    bonLivraison: ["read", "create", "update"],
    message: ["read", "create"],
    campagne: ["read", "create", "update", "delete"],
    prixAchat: ["read", "update"],
  },
  MECANICIEN: {
    ordre: ["read", "update"],
    photo: ["read", "create"],
    // Planning en lecture seule, limité à ses propres rendez-vous.
    rdv: ["read"],
  },
};

/** Ressources dont l'accès d'un mécanicien est limité à ses propres enregistrements. */
const OWNED_ONLY: Partial<Record<Role, Resource[]>> = {
  MECANICIEN: ["ordre", "photo", "rdv"],
};

export function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "SECRETARIAT" || value === "MECANICIEN";
}

/**
 * Indique si l'utilisateur peut effectuer `action` sur `resource`.
 * `ownerId` : identifiant du propriétaire de l'enregistrement, requis pour les rôles
 * limités à leurs propres données (mécanicien).
 */
export function can(
  user: PermissionUser | null | undefined,
  action: Action,
  resource: Resource,
  ownerId?: string | null,
): boolean {
  if (!user || !isRole(user.role)) return false;
  const allowed = MATRIX[user.role][resource];
  if (!allowed || !allowed.includes(action)) return false;
  if (OWNED_ONLY[user.role]?.includes(resource) && ownerId !== undefined) {
    return ownerId === user.id;
  }
  return true;
}

/** Les marges (prix de vente − prix d'achat) ne sont visibles que de l'administrateur. */
export function canSeeMargins(user: PermissionUser | null | undefined): boolean {
  return can(user, "read", "marge");
}

/** Le prix d'achat d'une pièce est visible de l'administrateur et du Magasin, jamais de l'Atelier. */
export function canSeePurchasePrice(user: PermissionUser | null | undefined): boolean {
  return can(user, "read", "prixAchat");
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SECRETARIAT: "Magasin",
  MECANICIEN: "Atelier",
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  group?: string;
  resource: Resource;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "layout-dashboard", resource: "client" },
  { href: "/devis", label: "Devis", icon: "file-text", group: "Atelier", resource: "devis" },
  { href: "/ordres-reparation", label: "Ordres de réparation", icon: "wrench", group: "Atelier", resource: "ordre" },
  { href: "/rendez-vous", label: "Rendez-vous", icon: "calendar", group: "Atelier", resource: "rdv" },
  { href: "/clients", label: "Clients", icon: "users", group: "Clients", resource: "client" },
  { href: "/vehicules", label: "Véhicules", icon: "car", group: "Clients", resource: "vehicule" },
  { href: "/campagnes", label: "Campagnes", icon: "megaphone", group: "Clients", resource: "campagne" },
  { href: "/stock", label: "Stock", icon: "box", group: "Gestion", resource: "piece" },
  { href: "/bons-livraison", label: "Commandes et livraisons", icon: "truck", group: "Gestion", resource: "bonCommande" },
  { href: "/factures", label: "Factures", icon: "receipt", group: "Gestion", resource: "facture" },
  { href: "/relances", label: "Relances", icon: "bell-ring", group: "Gestion", resource: "facture" },
  { href: "/tarifs", label: "Tarifs", icon: "tag", group: "Gestion", resource: "tarif" },
  { href: "/analyse", label: "Analyse", icon: "bar-chart-3", group: "Gestion", resource: "analyse" },
  { href: "/collaborateurs", label: "Collaborateurs", icon: "user-cog", group: "Gestion", resource: "collaborateur" },
  { href: "/mon-garage", label: "Mon Garage", icon: "store", group: "Gestion", resource: "parametre" },
  { href: "/parametres", label: "Paramètres", icon: "settings", group: "Gestion", resource: "parametre" },
];

export function navFor(user: PermissionUser): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    // Le tableau de bord est réservé aux rôles qui ont accès aux clients (admin, secrétariat).
    return can(user, "read", item.resource);
  });
}
