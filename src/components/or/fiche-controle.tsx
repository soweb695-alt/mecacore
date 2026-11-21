"use client";

import { CheckCircle2, ClipboardCheck, Loader2, PenLine, Printer, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CroquisVehicule } from "@/components/or/croquis-vehicule";
import { SignaturePad } from "@/components/or/signature-pad";
import { StatusBadge, type Tone } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { COLONNES, COLONNES_ANCIEN, grouperParCategorie, LIBELLE_NON_CONCERNE, pointRenseigne, type Dommage, type Resultat, type TypeStatuts } from "@/lib/fiche-controle";
import { cn } from "@/lib/utils";

type StatutFiche = "EN_COURS" | "TRANSMISE" | "TRAITEE";

const LIBELLE_STATUT: Record<StatutFiche, string> = { EN_COURS: "En cours de saisie", TRANSMISE: "Transmise au Magasin", TRAITEE: "Traitée" };
const TONE_STATUT: Record<StatutFiche, Tone> = { EN_COURS: "neutral", TRANSMISE: "warn", TRAITEE: "ok" };
/** Couleur du statut choisi : vert pour « Ok », rouge pour un défaut, gris pour « non concerné ». */
const COULEUR: Partial<Record<Resultat, string>> = {
  OK: "data-[on=true]:bg-success",
  ABIME: "data-[on=true]:bg-destructive",
  NON_CONFORME: "data-[on=true]:bg-destructive",
  A_REPARER: "data-[on=true]:bg-destructive",
  DEFAUT: "data-[on=true]:bg-destructive",
  A_SURVEILLER: "data-[on=true]:bg-warning",
  NON_CONCERNE: "data-[on=true]:bg-muted-foreground",
};

export interface PointFicheVue {
  id: string;
  libelle: string;
  resultat: Resultat;
  categorie: string | null;
  categoriePosition: number;
  typeStatuts: TypeStatuts | null;
}

export function FicheControle({
  ordreId,
  version,
  statut,
  entete,
  points,
  remarques,
  dommages: dommagesInitiaux,
  examinant,
  responsable,
  validee,
  peutRemplir,
  peutTraiter,
  nomUtilisateur,
}: {
  ordreId: string;
  /** 1 : ancien modèle (liste simple) ; 2 : fiche par catégories. */
  version: number;
  statut: StatutFiche;
  entete: { date: string; immatriculation: string; marque: string; kilometrage: string };
  points: PointFicheVue[];
  remarques: string;
  dommages: Dommage[];
  examinant: { nom: string; prenom: string; signe: boolean };
  responsable: { nom: string; le: string | null; signe: boolean };
  /** « le 26/10 à 14:30 par Karim » quand la fiche a été transmise. */
  validee: string | null;
  peutRemplir: boolean;
  /** Magasin / administrateur : vérification du responsable et renvoi à l'atelier. */
  peutTraiter: boolean;
  /** Proposé comme nom du responsable. */
  nomUtilisateur: string;
}) {
  const router = useRouter();
  const editable = peutRemplir && statut === "EN_COURS";
  const [res, setRes] = useState<Record<string, Resultat>>(Object.fromEntries(points.map((p) => [p.id, p.resultat])));
  const [notes, setNotes] = useState(remarques);
  const [dommages, setDommages] = useState(dommagesInitiaux);
  const [nom, setNom] = useState(examinant.nom);
  const [prenom, setPrenom] = useState(examinant.prenom);
  const [signature, setSignature] = useState<string | null>(null);
  const [respNom, setRespNom] = useState(responsable.nom || nomUtilisateur);
  const [respSignature, setRespSignature] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const manquants = points.filter((p) => !pointRenseigne(p.typeStatuts, res[p.id])).length;
  const groupes = version >= 2 ? grouperParCategorie(points) : [{ categorie: "Points de contrôle", typeStatuts: null, points }];
  const pretAValider = manquants === 0 && nom.trim() !== "" && prenom.trim() !== "" && signature !== null;

  async function appeler(fn: () => Promise<unknown>, ok: string) {
    setPending(true);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const sauver = (valider: boolean) =>
    appeler(
      () =>
        api(`/api/ordres-reparation/${ordreId}/fiche`, "PUT", {
          points: points.map((p) => ({ id: p.id, resultat: res[p.id] })),
          remarques: notes,
          ...(version >= 2 ? { dommages } : {}),
          valider,
          ...(nom.trim() && prenom.trim() ? { examinant: { nom, prenom, ...(valider && signature ? { signature } : {}) } } : {}),
        }),
      valider ? "Fiche transmise au Magasin" : "Fiche enregistrée",
    );

  /** Case de statut : bouton radio tactile (ou case à cocher pour les papiers). */
  const caseStatut = (p: PointFicheVue, valeur: Resultat, libelle: string, typeCase: boolean) => {
    const on = res[p.id] === valeur;
    if (!editable) {
      return <span aria-label={on ? `${p.libelle} : ${libelle}` : undefined} className={cn("inline-flex size-6 items-center justify-center rounded-md border text-sm font-bold", on && "border-transparent bg-foreground text-background")}>{on ? "✓" : ""}</span>;
    }
    return (
      <button
        type="button"
        role={typeCase ? "checkbox" : "radio"}
        aria-checked={on}
        aria-label={`${p.libelle} : ${libelle}`}
        data-on={on}
        disabled={pending}
        onClick={() => setRes((r) => ({ ...r, [p.id]: typeCase ? (on ? "NON_VERIFIE" : "OK") : valeur }))}
        className={cn("inline-flex size-9 items-center justify-center rounded-lg border text-base font-bold transition-colors hover:bg-muted data-[on=true]:border-transparent data-[on=true]:text-white", COULEUR[valeur])}
      >
        {on ? "✓" : ""}
      </button>
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5" aria-hidden />
          Fiche de contrôle du véhicule
        </CardTitle>
        <div className="flex items-center gap-2">
          <StatusBadge tone={TONE_STATUT[statut]}>{LIBELLE_STATUT[statut]}</StatusBadge>
          <a href={`/api/ordres-reparation/${ordreId}/fiche/pdf`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Printer aria-hidden />
            Imprimer la fiche
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* En-tête : date, immatriculation, marque, kilométrage */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-sm sm:grid-cols-4">
          {(
            [
              ["Date", entete.date],
              ["Immatriculation", entete.immatriculation],
              ["Marque", entete.marque],
              ["Kilométrage", entete.kilometrage],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v || "–"}</dd>
            </div>
          ))}
        </dl>

        {points.length === 0 && <p className="text-sm text-muted-foreground">Aucun point de contrôle n&apos;est paramétré (Paramètres › Fiche de contrôle).</p>}

        {/* Catégories : une table par catégorie, colonnes de statut */}
        <div className="grid gap-5 lg:grid-cols-2">
          {groupes.map((g) => {
            const colonnes = g.typeStatuts ? COLONNES[g.typeStatuts] : COLONNES_ANCIEN;
            const typeCase = g.typeStatuts === "CASE";
            const avecNA = g.typeStatuts !== null && !typeCase;
            return (
              <table key={g.categorie} className="w-full self-start text-sm">
                <caption className="pb-1.5 text-left text-sm font-semibold">{g.categorie}</caption>
                <thead>
                  <tr className="bg-muted text-xs text-muted-foreground">
                    <th className="rounded-l-lg px-2 py-1.5 text-left font-medium">Élément</th>
                    {colonnes.map((c) => (
                      <th key={c.valeur} className="w-16 px-1 py-1.5 text-center font-medium">
                        {c.libelle}
                      </th>
                    ))}
                    {avecNA && <th className="w-12 rounded-r-lg px-1 py-1.5 text-center font-medium">{LIBELLE_NON_CONCERNE}</th>}
                    {!avecNA && <th className="w-0 rounded-r-lg p-0" />}
                  </tr>
                </thead>
                <tbody>
                  {g.points.map((p) => (
                    <tr key={p.id} role={typeCase ? undefined : "radiogroup"} aria-label={typeCase ? undefined : p.libelle} className="border-b last:border-0">
                      <td className={cn("px-2 py-1.5", editable && !pointRenseigne(p.typeStatuts, res[p.id]) && "text-muted-foreground")}>{p.libelle}</td>
                      {colonnes.map((c) => (
                        <td key={c.valeur} className="px-1 py-1 text-center">
                          {caseStatut(p, c.valeur, c.libelle, typeCase)}
                        </td>
                      ))}
                      {avecNA && <td className="px-1 py-1 text-center">{caseStatut(p, "NON_CONCERNE", "non concerné", false)}</td>}
                      {!avecNA && <td className="w-0 p-0" />}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })}
        </div>

        {version >= 2 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Croquis : endroits abîmés</h3>
            <CroquisVehicule dommages={dommages} onChange={editable ? setDommages : undefined} />
          </section>
        )}

        <section className="space-y-1.5">
          <label htmlFor="fiche-remarques" className="text-sm font-semibold">
            Observations
          </label>
          {editable ? (
            <Textarea id="fiche-remarques" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Points d'attention, pièces à prévoir, conseils au client…" />
          ) : (
            <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">{notes || "Aucune observation."}</p>
          )}
        </section>

        {/* Signatures : examinant (atelier) et vérification du responsable (Magasin / administrateur) */}
        <section className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">Examinant</h3>
            {editable ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label="Nom de l'examinant" placeholder="Nom" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
                  <Input aria-label="Prénom de l'examinant" placeholder="Prénom" maxLength={60} value={prenom} onChange={(e) => setPrenom(e.target.value)} />
                </div>
                {signature ? (
                  <div className="flex items-center justify-between gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local de la signature */}
                    <img src={signature} alt="Signature de l'examinant" className="h-16 rounded border bg-white" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setSignature(null)}>
                      Refaire
                    </Button>
                  </div>
                ) : (
                  <SignaturePad label="Signature de l'examinant" libelleValider="Enregistrer la signature" hauteur={200} onSave={setSignature} />
                )}
              </>
            ) : (
              <>
                <p className="text-sm">{[examinant.prenom, examinant.nom].filter(Boolean).join(" ") || "–"}</p>
                {examinant.signe ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image servie par une route authentifiée
                  <img src={`/api/ordres-reparation/${ordreId}/fiche/signature?qui=examinant`} alt="Signature de l'examinant" className="h-16 rounded border bg-white" />
                ) : (
                  <p className="text-xs text-muted-foreground">Non signée.</p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">Vérification du responsable</h3>
            {responsable.signe ? (
              <>
                <p className="text-sm">
                  {responsable.nom}
                  {responsable.le && <span className="text-muted-foreground"> · {responsable.le}</span>}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- image servie par une route authentifiée */}
                <img src={`/api/ordres-reparation/${ordreId}/fiche/signature?qui=responsable`} alt="Signature du responsable" className="h-16 rounded border bg-white" />
              </>
            ) : peutTraiter && statut !== "EN_COURS" ? (
              <>
                <Input aria-label="Nom du responsable" placeholder="Nom et prénom" maxLength={80} value={respNom} onChange={(e) => setRespNom(e.target.value)} />
                {respSignature ? (
                  <div className="flex items-center justify-between gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local de la signature */}
                    <img src={respSignature} alt="Signature du responsable" className="h-16 rounded border bg-white" />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setRespSignature(null)}>
                        Refaire
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || respNom.trim().length < 2}
                        onClick={() => appeler(() => api(`/api/ordres-reparation/${ordreId}/fiche/verifier`, "POST", { nom: respNom, signature: respSignature }), "Fiche vérifiée et signée")}
                      >
                        <PenLine aria-hidden />
                        Signer la vérification
                      </Button>
                    </div>
                  </div>
                ) : (
                  <SignaturePad label="Signature du responsable" libelleValider="Enregistrer la signature" hauteur={200} onSave={setRespSignature} />
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{statut === "EN_COURS" ? "Après la validation par l'atelier." : "Non vérifiée."}</p>
            )}
          </div>
        </section>

        {validee && <p className="text-xs text-muted-foreground">Transmise {validee}.</p>}
        {editable && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!pretAValider && (
              <span className="mr-auto text-xs text-muted-foreground">
                {manquants > 0 ? `${manquants} point${manquants > 1 ? "s" : ""} à renseigner` : "Nom, prénom et signature de l'examinant"} pour valider
              </span>
            )}
            <Button variant="outline" disabled={pending} onClick={() => sauver(false)}>
              Enregistrer
            </Button>
            <Button disabled={pending || !pretAValider} onClick={() => sauver(true)}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
              Valider et transmettre au Magasin
            </Button>
          </div>
        )}
        {peutTraiter && statut === "TRANSMISE" && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => appeler(() => api(`/api/ordres-reparation/${ordreId}/fiche/renvoyer`, "POST"), "Fiche renvoyée à l'atelier")}>
              <Undo2 aria-hidden />
              Renvoyer à l&apos;atelier
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
