"use client";

import { createContext, useContext } from "react";
import { MODES_PAIEMENT, type ModePaiementCle } from "@/lib/validators/parametres";

/** Paramètres utiles aux formulaires (Paramètres › Facturation et Stocks), fournis par la mise en page du tableau de bord. */
export interface ParametresClient {
  modesPaiement: ModePaiementCle[];
  delaiPaiementDefaut: number;
  seuilAlerteDefaut: number;
  categories: string[];
}

export const PARAMETRES_DEFAUT: ParametresClient = { modesPaiement: [...MODES_PAIEMENT], delaiPaiementDefaut: 30, seuilAlerteDefaut: 5, categories: [] };

const Ctx = createContext<ParametresClient>(PARAMETRES_DEFAUT);

export function ParametresProvider({ valeur, children }: { valeur: ParametresClient; children: React.ReactNode }) {
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export const useParametres = () => useContext(Ctx);

/**
 * Modes de paiement à proposer dans une liste : ceux acceptés (Paramètres › Facturation),
 * plus la valeur déjà enregistrée si elle n'y figure plus (une facture ancienne reste lisible).
 */
export function useModesPaiement(valeurActuelle?: string | null): ModePaiementCle[] {
  const { modesPaiement } = useParametres();
  return MODES_PAIEMENT.filter((m) => modesPaiement.includes(m) || m === valeurActuelle);
}
