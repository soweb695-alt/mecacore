"use client";

import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { appliquerRemiseGlobale, formatEUR, type RemiseGlobale, type Totaux } from "@/lib/money";

export interface OptionsFactureState {
  valeur: string;
  type: "EUROS" | "POURCENT";
  base: "HT" | "TTC";
  mode: "" | "CB" | "ESPECES" | "CHEQUE" | "VIREMENT" | "PLUSIEURS_FOIS";
}

export const optionsInitiales: OptionsFactureState = { valeur: "", type: "POURCENT", base: "HT", mode: "" };

export function remiseDepuisState(o: OptionsFactureState): RemiseGlobale | null {
  const v = Number(o.valeur.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? { type: o.type, base: o.base, valeur: v } : null;
}

/**
 * Corps à envoyer à l'API : remise globale et mode de règlement prévu.
 * `heriterSiVide` : champ vide = reprendre les remises des devis (remise absente du corps) au lieu de « aucune remise ».
 */
export const payloadOptions = (o: OptionsFactureState, heriterSiVide = false) => {
  const remise = remiseDepuisState(o);
  return { ...(remise || !heriterSiVide ? { remise } : {}), modePaiement: o.mode || null };
};

/** État du formulaire à partir d'une remise enregistrée (devis). */
export const stateDepuisRemise = (r: RemiseGlobale | null, base: OptionsFactureState = optionsInitiales): OptionsFactureState =>
  r ? { ...base, valeur: String(r.valeur), type: r.type, base: r.base } : base;

/** Aperçu des totaux après remise ; renvoie une erreur lisible si la remise est trop forte. */
export function apercu(totaux: Totaux, o: OptionsFactureState): { totaux: Totaux & { montantRemise: number }; erreur: string | null } {
  try {
    const t = appliquerRemiseGlobale(totaux, remiseDepuisState(o));
    return { totaux: t, erreur: o.type === "POURCENT" && Number(o.valeur) >= 100 ? "Le pourcentage doit être inférieur à 100" : null };
  } catch {
    return { totaux: { ...totaux, montantRemise: 0 }, erreur: "La remise doit être inférieure au total" };
  }
}

/** Remise globale (€ ou %, sur HT ou TTC) et mode de règlement : communs à toute création de facture. */
export function OptionsFactureFields({ value, onChange, totaux, sansMode = false, idPrefix = "remise" }: { value: OptionsFactureState; onChange: (v: OptionsFactureState) => void; totaux?: Totaux; sansMode?: boolean; idPrefix?: string }) {
  const set = (p: Partial<OptionsFactureState>) => onChange({ ...value, ...p });
  const a = totaux ? apercu(totaux, value) : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
        <Field label="Remise globale" htmlFor={`${idPrefix}-valeur`} error={a?.erreur ?? undefined}>
          <Input id={`${idPrefix}-valeur`} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={value.valeur} onChange={(e) => set({ valeur: e.target.value })} aria-invalid={!!a?.erreur} />
        </Field>
        <Field label="Unité" htmlFor={`${idPrefix}-type`}>
          <NativeSelect id={`${idPrefix}-type`} value={value.type} onChange={(e) => set({ type: e.target.value as OptionsFactureState["type"] })}>
            <option value="POURCENT">%</option>
            <option value="EUROS">€</option>
          </NativeSelect>
        </Field>
        <Field label="Calculée sur" htmlFor={`${idPrefix}-base`}>
          <NativeSelect id={`${idPrefix}-base`} value={value.base} onChange={(e) => set({ base: e.target.value as OptionsFactureState["base"] })}>
            <option value="HT">Total HT</option>
            <option value="TTC">Total TTC</option>
          </NativeSelect>
        </Field>
      </div>
      {a && a.totaux.montantRemise > 0 && !a.erreur && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Remise de <b>{formatEUR(a.totaux.montantRemise)}</b> ({value.base}) · total HT {formatEUR(a.totaux.totalHT)} · <b>TTC {formatEUR(a.totaux.totalTTC)}</b>
        </p>
      )}
      {!sansMode && (
      <Field label="Mode de règlement prévu" htmlFor="mode-paiement" hint="« Virement » ajoute l'IBAN et le BIC du garage sur le PDF.">
        <NativeSelect id="mode-paiement" value={value.mode} onChange={(e) => set({ mode: e.target.value as OptionsFactureState["mode"] })}>
          <option value="">Non précisé</option>
          <option value="CB">Carte bancaire</option>
          <option value="ESPECES">Espèces</option>
          <option value="CHEQUE">Chèque</option>
          <option value="VIREMENT">Virement</option>
          <option value="PLUSIEURS_FOIS">Paiement en plusieurs fois</option>
        </NativeSelect>
      </Field>
      )}
    </div>
  );
}
