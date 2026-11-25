"use client";

import { Eye, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DescriptifLigne, type PieceDescriptif } from "@/components/devis/descriptif-ligne";
import { SearchPicker } from "@/components/devis/search-picker";
import { apercu, OptionsFactureFields, optionsInitiales, payloadOptions, type OptionsFactureState } from "@/components/factures/options-facture";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { appliquerRemisePro, calculerTotaux, formatEUR, prixHTDepuisTTC, prixTTCDepuisHT } from "@/lib/money";

type TypeLigne = "MAIN_OEUVRE" | "FORFAIT" | "PIECE" | "FRAIS_DIVERS";

interface Ligne {
  key: string;
  /** Ligne existante d'un brouillon : garde ses pièces de forfait. */
  id?: string;
  /** Pièces comprises (forfait), pour information. */
  composition?: string;
  type: TypeLigne;
  designation: string;
  /** Descriptif imprimé sous la ligne (pré-rempli depuis le tarif, modifiable). */
  description?: string;
  /** Pièces du stock rattachées depuis le descriptif (déduites du stock à l'émission). */
  piecesDescriptif?: PieceDescriptif[];
  quantite: string;
  prixUnitaireHT: string;
  /** PU TTC : fait foi pour les totaux ; modifier le HT ou le TTC recalcule l'autre. */
  prixTTC: string;
  tvaRate: string;
  pieceId: string | null;
  stock: number | null;
  prixCatalogueHT: number | null;
}

interface ClientHit {
  id: string;
  type: "PARTICULIER" | "PRO";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  discountRate: number | string;
}

interface PieceHit {
  id: string;
  reference: string;
  nom: string;
  prixVenteHT: number;
  prixVenteTTC?: number;
  stock: number;
  referenceCroisee?: string | null;
}

const TYPES: Record<TypeLigne, string> = { MAIN_OEUVRE: "Main d'œuvre", FORFAIT: "Forfait", PIECE: "Pièce", FRAIS_DIVERS: "Frais divers" };
let compteur = 0;
const cle = () => `f${++compteur}`;
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")));
/** PU HT fixé (catalogue, remise, saisie) : le TTC suit, au centime. */
const avecHT = (ht: number, taux = 20) => ({ prixUnitaireHT: String(ht), prixTTC: String(prixTTCDepuisHT(ht, taux)) });
const nomClientHit = (c: ClientHit) => (c.type === "PRO" && c.companyName ? c.companyName : [c.firstName, c.lastName].filter(Boolean).join(" "));

/** Tarif proposé à l'ajout d'une ligne (forfait, main d'œuvre, frais divers). */
export interface TarifLite {
  id: string;
  type: string;
  libelle: string;
  description: string | null;
  montantHT: number;
}

export interface BrouillonInitial {
  id: string;
  client: { id: string; nom: string; pro: boolean; remisePct: number };
  lignes: (Omit<Ligne, "key" | "prixTTC"> & { prixUnitaireTTC?: number | null })[];
  options: OptionsFactureState;
}

/**
 * Facture saisie directement (sans devis ni bon de livraison) : les pièces du stock sont décrémentées à l'émission.
 * Avec `brouillon` : modification de la facture préparée à la fin d'un OR, puis émission (numéro attribué à ce moment).
 */
export function FactureForm({ echeanceParDefaut, brouillon, tarifs = [] }: { echeanceParDefaut: string; brouillon?: BrouillonInitial; tarifs?: TarifLite[] }) {
  const router = useRouter();
  const [client, setClient] = useState<{ id: string; nom: string; pro: boolean; remisePct: number } | null>(brouillon?.client ?? null);
  const [lignes, setLignes] = useState<Ligne[]>(() => (brouillon?.lignes ?? []).map(({ prixUnitaireTTC, ...l }) => ({ ...l, key: cle(), prixTTC: String(prixUnitaireTTC ?? prixTTCDepuisHT(num(l.prixUnitaireHT), num(l.tvaRate))) })));
  const [options, setOptions] = useState<OptionsFactureState>(brouillon?.options ?? optionsInitiales);
  const [echeance, setEcheance] = useState(echeanceParDefaut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);
  const fetchPieces = useCallback(async (q: string) => (await api<{ items: PieceHit[] }>(`/api/stock?q=${encodeURIComponent(q)}`, "GET")).items, []);

  const sousTotaux = useMemo(() => calculerTotaux(lignes.map((l) => ({ quantite: num(l.quantite), prixUnitaireHT: num(l.prixUnitaireHT), prixUnitaireTTC: num(l.prixTTC), tvaRate: num(l.tvaRate) }))), [lignes]);
  const a = apercu(sousTotaux, options);

  const maj = (k: string, p: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));
  const ajouterLibre = (type: TypeLigne) => setLignes((ls) => [...ls, { key: cle(), type, designation: "", quantite: "1", ...avecHT(0), tvaRate: "20", pieceId: null, stock: null, prixCatalogueHT: null }]);
  /** Tarif choisi (ex. forfait vidange) : libellé, prix et descriptif recopiés, tous modifiables pour cette facture. */
  const ajouterTarif = (type: TypeLigne, id: string) => {
    const t = tarifs.find((x) => x.id === id);
    if (t) setLignes((ls) => [...ls, { key: cle(), type, designation: t.libelle, description: t.description ?? "", quantite: "1", ...avecHT(t.montantHT), tvaRate: "20", pieceId: null, stock: null, prixCatalogueHT: null }]);
  };
  const tarifsDe = (type: TypeLigne) => tarifs.filter((x) => (type === "MAIN_OEUVRE" ? x.type.startsWith("MO") : x.type === type));
  const ajouterPiece = (p: PieceHit) =>
    setLignes((ls) => [
      ...ls,
      { key: cle(), type: "PIECE", designation: `${p.nom} (${p.reference})`, quantite: "1", ...(!client?.remisePct && p.prixVenteTTC ? { prixUnitaireHT: String(prixHTDepuisTTC(p.prixVenteTTC, 20)), prixTTC: String(p.prixVenteTTC) } : avecHT(appliquerRemisePro(p.prixVenteHT, client?.remisePct ?? 0))), tvaRate: "20", pieceId: p.id, stock: p.stock, prixCatalogueHT: p.prixVenteHT },
    ]);

  // La remise professionnelle suit le client : les pièces du stock sont recalculées depuis leur prix catalogue.
  function choisirClient(c: ClientHit) {
    const remisePct = c.type === "PRO" ? Number(c.discountRate) : 0;
    setClient({ id: c.id, nom: nomClientHit(c), pro: c.type === "PRO", remisePct });
    setLignes((ls) => ls.map((l) => (l.pieceId && l.prixCatalogueHT !== null ? { ...l, ...avecHT(appliquerRemisePro(l.prixCatalogueHT, remisePct), num(l.tvaRate)) } : l)));
  }

  /**
   * « Enregistrer en brouillon », « Aperçu PDF » (enregistre le brouillon puis ouvre son PDF filigrané « BROUILLON »)
   * ou « Émettre la facture » (numéro légal attribué, stock ajusté).
   */
  async function soumettre(action: "brouillon" | "apercu" | "emettre") {
    setErreur(null);
    if (!client) return setErreur("Choisissez le client.");
    if (lignes.length === 0) return setErreur("Ajoutez au moins une ligne.");
    if (lignes.some((l) => !l.designation.trim() || num(l.quantite) <= 0)) return setErreur("Chaque ligne doit avoir une désignation et une quantité positive.");
    if (a.erreur) return setErreur(a.erreur);
    // Fenêtre ouverte tout de suite (au clic) : sinon le navigateur bloque l'ouverture après l'enregistrement.
    const fenetre = action === "apercu" ? window.open("about:blank", "_blank") : null;
    const ouvrirApercu = (id: string) => {
      const url = `/api/factures/${id}/pdf`;
      if (fenetre) fenetre.location.href = url;
      else window.open(url, "_blank");
    };
    setPending(true);
    try {
      const corps = {
        dateEcheance: echeance || undefined,
        lignes: lignes.map((l) => ({
          ...(l.id ? { id: l.id } : {}),
          type: l.type,
          designation: l.designation.trim(),
          description: l.description?.trim() || null,
          piecesDescriptif: (l.piecesDescriptif ?? []).map((p) => ({ pieceId: p.pieceId, quantite: p.quantite })),
          quantite: num(l.quantite),
          prixUnitaireHT: num(l.prixUnitaireHT),
          prixUnitaireTTC: num(l.prixTTC),
          tvaRate: num(l.tvaRate),
          pieceId: l.pieceId,
          prixCatalogueHT: l.type === "PIECE" && l.prixCatalogueHT !== null && client.remisePct > 0 ? l.prixCatalogueHT : null,
        })),
        ...payloadOptions(options),
      };
      if (brouillon) {
        await api(`/api/factures/${brouillon.id}`, "PUT", corps);
        if (action !== "emettre") {
          if (action === "apercu") ouvrirApercu(brouillon.id);
          else toast.success("Brouillon enregistré");
          setPending(false);
          return router.refresh();
        }
        const r = await api<{ id: string; numero: string }>(`/api/factures/${brouillon.id}/emettre`, "POST");
        toast.success(`Facture ${r.numero} émise`);
        return router.refresh();
      }
      const r = await api<{ id: string; numero: string | null }>("/api/factures/manuelle", "POST", { clientId: client.id, ...corps, brouillon: action !== "emettre" });
      if (action === "apercu") ouvrirApercu(r.id);
      toast.success(action === "emettre" ? `Facture ${r.numero} émise` : "Brouillon enregistré : vous pouvez le modifier, le prévisualiser puis l'émettre.");
      router.push(`/factures/${r.id}`);
    } catch (e) {
      fenetre?.close();
      setErreur(e instanceof Error ? e.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-medium">
                {client.nom}
                {client.pro && client.remisePct > 0 && <span className="ml-2 text-xs text-success">PRO · remise {client.remisePct} % sur les pièces</span>}
              </span>
              {!brouillon && (
                <button type="button" className="text-xs text-link hover:underline" onClick={() => setClient(null)}>
                  Changer
                </button>
              )}
            </div>
          )}
          {!client && (
            <div className="max-w-md">
              <SearchPicker<ClientHit> label="Rechercher un client" placeholder="Rechercher un client (nom, prénom, société…)" fetcher={fetchClients} getKey={(c) => c.id} renderItem={nomClientHit} onPick={choisirClient} />
            </div>
          )}
          <Field label="Échéance de paiement" htmlFor="echeance" hint="Par défaut : délai de paiement du client." className="max-w-xs">
            <Input id="echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lignes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-md">
            <SearchPicker<PieceHit>
              label="Ajouter une pièce du stock"
              placeholder="Ajouter une pièce du stock (référence, nom, référence croisée…)"
              fetcher={fetchPieces}
              getKey={(p) => p.id}
              renderItem={(p) => (
                <span className="flex justify-between gap-3">
                  <span>
                    <b>{p.reference}</b> · {p.nom}
                    {p.referenceCroisee && <span className="block text-xs text-muted-foreground">Équivalent de {p.referenceCroisee}</span>}
                  </span>
                  <span className={p.stock <= 0 ? "text-destructive" : "text-muted-foreground"}>
                    {formatEUR(p.prixVenteHT)} HT · stock {p.stock}
                  </span>
                </span>
              )}
              onPick={ajouterPiece}
            />
          </div>
          {lignes.length === 0 && <p className="text-sm text-muted-foreground">Aucune ligne. Ajoutez une pièce du stock ou une ligne libre.</p>}
          {lignes.map((l) => (
            <div key={l.key} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 md:grid-cols-[9rem_1fr_6rem_7rem_7rem_6rem_auto]">
              <Field label="Type" htmlFor={`type-${l.key}`}>
                <NativeSelect id={`type-${l.key}`} value={l.type} disabled={!!l.pieceId || !!l.composition} onChange={(e) => maj(l.key, { type: e.target.value as TypeLigne })}>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Désignation" htmlFor={`des-${l.key}`} className="col-span-2 md:col-span-1" hint={l.composition}>
                <Input id={`des-${l.key}`} maxLength={200} value={l.designation} onChange={(e) => maj(l.key, { designation: e.target.value })} />
              </Field>
              <div className="col-span-full -mt-1 md:order-last">
                <DescriptifLigne valeur={l.description ?? ""} designation={l.designation} onChange={(v) => maj(l.key, { description: v })} pieces={l.piecesDescriptif} onPiecesChange={(p) => maj(l.key, { piecesDescriptif: p })} moment="à l'émission de la facture" />
              </div>
              <Field label="Qté" htmlFor={`qte-${l.key}`} hint={l.stock !== null ? `Stock : ${l.stock}` : undefined}>
                <Input id={`qte-${l.key}`} inputMode="decimal" value={l.quantite} onChange={(e) => maj(l.key, { quantite: e.target.value })} />
              </Field>
              <Field label="PU HT (€)" htmlFor={`pu-${l.key}`}>
                <Input id={`pu-${l.key}`} inputMode="decimal" value={l.prixUnitaireHT} onChange={(e) => maj(l.key, { prixUnitaireHT: e.target.value, prixTTC: String(prixTTCDepuisHT(num(e.target.value), num(l.tvaRate))), prixCatalogueHT: l.pieceId ? l.prixCatalogueHT : null })} />
              </Field>
              <Field label="PU TTC (€)" htmlFor={`ttc-${l.key}`}>
                <Input id={`ttc-${l.key}`} inputMode="decimal" value={l.prixTTC} onChange={(e) => maj(l.key, { prixTTC: e.target.value, prixUnitaireHT: String(prixHTDepuisTTC(num(e.target.value), num(l.tvaRate))), prixCatalogueHT: l.pieceId ? l.prixCatalogueHT : null })} />
              </Field>
              <Field label="TVA %" htmlFor={`tva-${l.key}`}>
                <Input id={`tva-${l.key}`} inputMode="decimal" value={l.tvaRate} onChange={(e) => maj(l.key, { tvaRate: e.target.value, prixUnitaireHT: String(prixHTDepuisTTC(num(l.prixTTC), num(e.target.value))) })} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label="Supprimer la ligne" onClick={() => setLignes((ls) => ls.filter((x) => x.key !== l.key))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(["FORFAIT", "MAIN_OEUVRE", "FRAIS_DIVERS"] as const).map((t) =>
              tarifsDe(t).length > 0 ? (
                // Tarifs du type (forfait vidange…) ou ligne libre.
                <NativeSelect
                  key={t}
                  aria-label={`Ajouter : ${TYPES[t]}`}
                  className="h-8 w-48 text-xs"
                  value=""
                  onChange={(e) => (e.target.value === "__libre" ? ajouterLibre(t) : e.target.value && ajouterTarif(t, e.target.value))}
                >
                  <option value="">+ {TYPES[t]}</option>
                  {tarifsDe(t).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.libelle} ({formatEUR(x.montantHT)} HT)
                    </option>
                  ))}
                  <option value="__libre">Ligne libre…</option>
                </NativeSelect>
              ) : (
                <Button key={t} type="button" variant="outline" size="sm" onClick={() => ajouterLibre(t)}>
                  <Plus aria-hidden />
                  {TYPES[t]}
                </Button>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remise et règlement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OptionsFactureFields value={options} onChange={setOptions} totaux={sousTotaux} />
          <div className="ml-auto w-72 space-y-1.5 text-sm">
            {a.totaux.montantRemise > 0 && !a.erreur && (
              <div className="flex justify-between text-success">
                <span>Remise ({options.base})</span>
                <span className="tabular-nums">− {formatEUR(a.totaux.montantRemise)}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="tabular-nums">{formatEUR(a.totaux.totalHT)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{formatEUR(a.totaux.totalTVA)}</span></div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold"><span>Total TTC</span><span className="tabular-nums">{formatEUR(a.totaux.totalTTC)}</span></div>
          </div>
        </CardContent>
      </Card>

      {erreur && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {!brouillon && (
          <Button type="button" variant="ghost" onClick={() => router.push("/factures")} disabled={pending}>
            Annuler
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => soumettre("brouillon")} disabled={pending}>
          <Save aria-hidden />
          {brouillon ? "Enregistrer le brouillon" : "Enregistrer en brouillon"}
        </Button>
        <Button type="button" variant="outline" onClick={() => soumettre("apercu")} disabled={pending}>
          <Eye aria-hidden />
          Aperçu PDF
        </Button>
        <Button type="button" onClick={() => soumettre("emettre")} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Émettre la facture
        </Button>
      </div>
    </div>
  );
}
