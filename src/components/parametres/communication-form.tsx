"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/form-dialog";
import { SectionParametres } from "@/components/parametres/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { MODELES_DEFAUT, VARIABLES, type CleModele } from "@/lib/messages/modeles-email";
import { communicationSchema, type CommunicationInput } from "@/lib/validators/parametres";

const TITRES: Record<CleModele, { titre: string; description: string }> = {
  vehiculePret: { titre: "E-mail « Véhicule prêt »", description: "Envoyé par le bouton « Véhicule prêt » de l'ordre de réparation." },
  rappelRdv: { titre: "E-mail « Rappel RDV »", description: "Envoyé par le bouton « Rappel RDV » du planning et par les rappels automatiques (J-7, J-1)." },
};

type Champ = "sujet" | "corps";

/**
 * Bloc d'un modèle : objet, message et boutons qui insèrent une variable {{nom}} à l'emplacement du curseur,
 * dans le dernier champ utilisé (l'objet ou le message).
 */
function BlocModele({ cle, valeur, onChange }: { cle: CleModele; valeur: { sujet: string; corps: string }; onChange: (v: { sujet: string; corps: string }) => void }) {
  const sujetRef = useRef<HTMLInputElement>(null);
  const corpsRef = useRef<HTMLTextAreaElement>(null);
  const dernier = useRef<Champ>("corps");

  function inserer(nom: string) {
    const champ = dernier.current;
    const el = champ === "sujet" ? sujetRef.current : corpsRef.current;
    const texte = valeur[champ];
    const jeton = `{{${nom}}}`;
    const debut = el?.selectionStart ?? texte.length;
    const fin = el?.selectionEnd ?? texte.length;
    onChange({ ...valeur, [champ]: texte.slice(0, debut) + jeton + texte.slice(fin) });
    // Curseur replacé juste après la variable insérée.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(debut + jeton.length, debut + jeton.length);
    });
  }

  const parDefaut = valeur.sujet === MODELES_DEFAUT[cle].sujet && valeur.corps === MODELES_DEFAUT[cle].corps;

  return (
    <SectionParametres titre={TITRES[cle].titre} description={TITRES[cle].description}>
      <div className="space-y-3">
        <Field label="Objet" htmlFor={`${cle}-sujet`}>
          <Input id={`${cle}-sujet`} ref={sujetRef} maxLength={150} value={valeur.sujet} onFocus={() => (dernier.current = "sujet")} onChange={(e) => onChange({ ...valeur, sujet: e.target.value })} />
        </Field>
        <Field label="Message" htmlFor={`${cle}-corps`}>
          <Textarea id={`${cle}-corps`} ref={corpsRef} rows={9} maxLength={4000} value={valeur.corps} onFocus={() => (dernier.current = "corps")} onChange={(e) => onChange({ ...valeur, corps: e.target.value })} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Insérer une variable (remplacée à l&apos;envoi) :</p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES[cle].map((x) => (
              // onMouseDown : le champ garde sa sélection au moment du clic.
              <Button key={x.nom} type="button" variant="outline" size="xs" title={`{{${x.nom}}}`} onMouseDown={(e) => e.preventDefault()} onClick={() => inserer(x.nom)}>
                <Plus aria-hidden />
                {x.libelle}
              </Button>
            ))}
          </div>
        </div>
        {!parDefaut && (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => onChange({ ...MODELES_DEFAUT[cle] })}>
            Rétablir le texte par défaut
          </Button>
        )}
      </div>
    </SectionParametres>
  );
}

/** Paramètres › Communication : expéditeur des e-mails et modèles « Véhicule prêt » / « Rappel RDV ». */
export function CommunicationForm({ initial, expediteurHebergeur }: { initial: CommunicationInput; expediteurHebergeur: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = communicationSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErreurs(errs);
      return void toast.error(parsed.error.issues[0]?.message ?? "Paramètres invalides");
    }
    setErreurs({});
    setPending(true);
    try {
      // Un modèle identique au texte par défaut est enregistré vide : il suivra les évolutions du texte par défaut.
      const corps = Object.fromEntries(
        (["vehiculePret", "rappelRdv"] as const).map((cle) => [
          cle,
          { sujet: parsed.data[cle].sujet === MODELES_DEFAUT[cle].sujet ? "" : parsed.data[cle].sujet, corps: parsed.data[cle].corps === MODELES_DEFAUT[cle].corps ? "" : parsed.data[cle].corps },
        ]),
      );
      await api("/api/parametres/communication", "PUT", { ...parsed.data, ...corps });
      toast.success("Paramètres de communication enregistrés");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionParametres
        titre="Expéditeur par défaut"
        description={
          <>
            Nom et adresse affichés comme expéditeur des e-mails (devis, véhicule prêt, rappels, campagnes). L&apos;adresse doit être validée dans votre compte Brevo, sinon l&apos;envoi échoue.
            {expediteurHebergeur && <> Vide : {expediteurHebergeur}.</>}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" htmlFor="expediteur-nom" error={erreurs.expediteurNom} hint="Vide : nom du garage">
            <Input id="expediteur-nom" maxLength={70} value={v.expediteurNom} onChange={(e) => setV((x) => ({ ...x, expediteurNom: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="expediteur-email" error={erreurs.expediteurEmail}>
            <Input id="expediteur-email" type="email" maxLength={120} value={v.expediteurEmail} aria-invalid={!!erreurs.expediteurEmail} onChange={(e) => setV((x) => ({ ...x, expediteurEmail: e.target.value }))} />
          </Field>
        </div>
      </SectionParametres>

      {(["vehiculePret", "rappelRdv"] as const).map((cle) => (
        <BlocModele key={cle} cle={cle} valeur={v[cle]} onChange={(m) => setV((x) => ({ ...x, [cle]: m }))} />
      ))}

      <div className="flex justify-end border-t pt-5">
        <SubmitButton pending={pending}>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
