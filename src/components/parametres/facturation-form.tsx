"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/form-dialog";
import { SectionParametres } from "@/components/parametres/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import {
  AFFICHAGES_REMISE,
  DELAIS_PAIEMENT,
  facturationSchema,
  libelleDelai,
  LIBELLES_AFFICHAGE_REMISE,
  LIBELLES_MODE,
  MENTIONS_FACTURE_DEFAUT,
  MODES_PAIEMENT,
  type FacturationInput,
} from "@/lib/validators/parametres";

const AIDE_REMISE: Record<FacturationInput["affichageRemise"], string> = {
  LIGNE: "Le prix catalogue et le taux de remise sont indiqués sous chaque pièce remisée.",
  TOTAL: "Les pièces apparaissent au prix catalogue ; une ligne « Remise PRO » est déduite avant le total HT.",
  MASQUER: "Le client ne voit que le prix final remisé, sans mention de remise.",
};

/** Paramètres › Facturation : un seul enregistrement pour tout l'onglet. */
export function FacturationForm({ initial }: { initial: FacturationInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const set = <K extends keyof FacturationInput>(k: K, val: FacturationInput[K]) => setV((x) => ({ ...x, [k]: val }));

  function basculerMode(m: (typeof MODES_PAIEMENT)[number], coche: boolean) {
    set("modesPaiement", coche ? MODES_PAIEMENT.filter((x) => x === m || v.modesPaiement.includes(x)) : v.modesPaiement.filter((x) => x !== m));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = facturationSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErreurs(errs);
      return void toast.error(parsed.error.issues[0]?.message ?? "Paramètres invalides");
    }
    setErreurs({});
    setPending(true);
    try {
      await api("/api/parametres/facturation", "PUT", parsed.data);
      toast.success("Paramètres de facturation enregistrés");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionParametres titre="Modes de paiement acceptés" description="Seuls les modes cochés sont proposés à l'encaissement et sur les factures ; ils sont rappelés sur le PDF des factures.">
        <fieldset className="grid gap-2.5 sm:grid-cols-2">
          <legend className="sr-only">Modes de paiement acceptés</legend>
          {MODES_PAIEMENT.map((m) => (
            <label key={m} className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={v.modesPaiement.includes(m)} onChange={(e) => basculerMode(m, e.target.checked)} />
              {LIBELLES_MODE[m]}
            </label>
          ))}
        </fieldset>
        {erreurs.modesPaiement && <p role="alert" className="mt-2 text-xs text-destructive">{erreurs.modesPaiement}</p>}
      </SectionParametres>

      <SectionParametres titre="Conditions de paiement par défaut" description="Délai proposé pour un nouveau client ; il reste modifiable sur la fiche du client, qui fixe l'échéance de ses factures.">
        <Field label="Délai de paiement" htmlFor="delai" className="max-w-xs">
          <NativeSelect id="delai" value={v.delaiPaiementDefaut} onChange={(e) => set("delaiPaiementDefaut", Number(e.target.value))}>
            {DELAIS_PAIEMENT.map((j) => (
              <option key={j} value={j}>
                {libelleDelai(j)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </SectionParametres>

      <SectionParametres titre="Préfixes de numérotation" description="Appliqués aux prochains documents (ex. FAC-2026-0042). Le compteur continue : les numéros déjà attribués ne changent pas.">
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["prefixDevis", "Préfixe Devis"],
              ["prefixFacture", "Préfixe Facture"],
              ["prefixBonLivraison", "Préfixe BL"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label} htmlFor={k} error={erreurs[k]}>
              <Input id={k} className="uppercase" maxLength={10} value={v[k]} aria-invalid={!!erreurs[k]} onChange={(e) => set(k, e.target.value.toUpperCase())} />
            </Field>
          ))}
        </div>
      </SectionParametres>

      <SectionParametres titre="Mentions légales sur factures" description="Conditions générales de vente et pénalités de retard, imprimées en bas de chaque facture.">
        <Field label="Mentions" htmlFor="mentions" error={erreurs.mentionsFacture}>
          <Textarea id="mentions" rows={6} maxLength={3000} value={v.mentionsFacture} onChange={(e) => set("mentionsFacture", e.target.value)} />
        </Field>
        {v.mentionsFacture.trim() !== MENTIONS_FACTURE_DEFAUT && (
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => set("mentionsFacture", MENTIONS_FACTURE_DEFAUT)}>
            Rétablir le texte par défaut
          </Button>
        )}
      </SectionParametres>

      <SectionParametres titre="Affichage des remises" description="Sur les PDF des devis et des factures. Les montants et les totaux sont identiques dans tous les cas.">
        <Field label="Remise professionnelle" htmlFor="affichage-remise" hint={AIDE_REMISE[v.affichageRemise]} className="max-w-sm">
          <NativeSelect id="affichage-remise" value={v.affichageRemise} onChange={(e) => set("affichageRemise", e.target.value as FacturationInput["affichageRemise"])}>
            {AFFICHAGES_REMISE.map((a) => (
              <option key={a} value={a}>
                {LIBELLES_AFFICHAGE_REMISE[a]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </SectionParametres>

      <div className="flex justify-end border-t pt-5">
        <SubmitButton pending={pending}>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
