import "server-only";

export interface FacturePourPA {
  id: string;
  numero: string;
  dateEmission: Date;
  dateEcheance: Date;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  client: { nom: string; siret: string | null; tvaNumber: string | null };
  lignes: { designation: string; quantite: number; prixUnitaireHT: number; tvaRate: number; totalHT: number }[];
}

export interface StatutPA {
  /** Statut côté plateforme : DEPOSEE, ACCEPTEE, REFUSEE… */
  statut: string;
  reference: string | null;
}

/** Contrat à implémenter pour brancher une Plateforme Agréée (PA) réelle. */
export interface FactureElectroniqueProvider {
  envoyer(facture: FacturePourPA): Promise<StatutPA>;
  recupererStatut(factureId: string): Promise<StatutPA>;
}

/** Implémentation de développement : aucune donnée ne quitte l'application. */
class MockProvider implements FactureElectroniqueProvider {
  private statuts = new Map<string, StatutPA>();

  async envoyer(f: FacturePourPA): Promise<StatutPA> {
    const s: StatutPA = { statut: "DEPOSEE (simulation)", reference: `MOCK-${f.numero}` };
    this.statuts.set(f.id, s);
    return s;
  }

  async recupererStatut(factureId: string): Promise<StatutPA> {
    return this.statuts.get(factureId) ?? { statut: "DEPOSEE (simulation)", reference: null };
  }
}

class NonConfigureProvider implements FactureElectroniqueProvider {
  constructor(private nom: string) {}
  async envoyer(): Promise<StatutPA> {
    throw new Error(`Plateforme Agréée « ${this.nom} » : implémentation à brancher (voir src/lib/integrations/facture-electronique.ts)`);
  }
  async recupererStatut(): Promise<StatutPA> {
    return this.envoyer();
  }
}

export function getFactureProvider(): FactureElectroniqueProvider {
  const nom = process.env.FACTURE_ELECTRONIQUE_PROVIDER ?? "mock";
  if (nom === "mock") return new MockProvider();
  // Brancher ici le client de la PA retenue (clé : FACTURE_ELECTRONIQUE_API_KEY).
  return new NonConfigureProvider(nom);
}
