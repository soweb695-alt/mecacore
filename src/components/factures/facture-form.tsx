"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { apercu, OptionsFactureFields, optionsInitiales, payloadOptions, type OptionsFactureState } from "@/components/factures/options-facture";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { appliquerRemisePro, calculerTotaux, formatEUR } from "@/lib/money";

type TypeLigne = "MAIN_OEUVRE" | "FORFAIT" | "PIECE" | "FRAIS_DIVERS";

interface Ligne {
  key: string;
  /** Ligne existante d'un brouillon : garde ses pièces de forfait. */
  id?: string;
  /** Pièces comprises (forfait), pour information. */
  composition?: string;
  type: TypeLigne;
  designation: string;
  quantite: string;
  prixUnitaireHT: string;
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
  stock: number;
  referenceCroisee?: string | null;
}

const TYPES: Record<TypeLigne, string> = { MAIN_OEUVRE: "Main d'œuvre", FORFAIT: "Forfait", PIECE: "Pièce", FRAIS_DIVERS: "Frais divers" };
let compteur = 0;
const cle = () => `f${++compteur}`;
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")));
const nomClientHit = (c: ClientHit) => (c.type === "PRO" && c.companyName ? c.companyName : [c.firstName, c.lastName].filter(Boolean).join(" "));

export interface BrouillonInitial {
  id: string;
  client: { id: string; nom: string; pro: boolean; remisePct: number };
  lignes: Omit<Ligne, "key">[];
  options: OptionsFactureState;
}

/**
 * Facture saisie directement (sans devis ni bon de livraison) : les pièces du stock sont décrémentées à l'émission.
 * Avec `brouillon` : modification de la facture préparée à la fin d'un OR, puis émission (numéro attribué à ce moment).
 */
export function FactureForm({ echeanceParDefaut, brouillon }: { echeanceParDefaut: string; brouillon?: BrouillonInitial }) {
  const router = useRouter();
  const [client, setClient] = useState<{ id: string; nom: string; pro: boolean; remisePct: number } | null>(brouillon?.client ?? null);
  const [lignes, setLignes] = useState<Ligne[]>(() => (brouillon?.lignes ?? []).map((l) => ({ ...l, key: cle() })));
  const [options, setOptions] = useState<OptionsFactureState>(brouillon?.options ?? optionsInitiales);
  const [echeance, setEcheance] = useState(echeanceParDefaut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);
  const fetchPieces = useCallback(async (q: string) => (await api<{ items: PieceHit[] }>(`/api/stock?q=${encodeURIComponent(q)}`, "GET")).items, []);

  const sousTotaux = useMemo(() => calculerTotaux(lignes.map((l) => ({ quantite: num(l.quantite), prixUnitaireHT: num(l.prixUnitaireHT), tvaRate: num(l.tvaRate) }))), [lignes]);
  const a = apercu(sousTotaux, options);

  const maj = (k: string, p: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));
  const ajouterLibre = (type: TypeLigne) => setLignes((ls) => [...ls, { key: cle(), type, designation: "", quantite: "1", prixUnitaireHT: "0", tvaRate: "20", pieceId: null, stock: null, prixCatalogueHT: null }]);
  const ajouterPiece = (p: PieceHit) =>
    setLignes((ls) => [
      ...ls,
      { key: cle(), type: "PIECE", designation: `${p.nom} (${p.reference})`, quantite: "1", prixUnitaireHT: String(appliquerRemisePro(p.prixVenteHT, client?.remisePct ?? 0)), tvaRate: "20", pieceId: p.id, stock: p.stock, prixCatalogueHT: p.prixVenteHT },
    ]);

  // La remise professionnelle suit le client : les pièces du stock sont recalculées depuis leur prix catalogue.
  function choisirClient(c: ClientHit) {
    const remisePct = c.type === "PRO" ? Number(c.discountRate) : 0;
    setClient({ id: c.id, nom: nomClientHit(c), pro: c.type === "PRO", remisePct });
    setLignes((ls) => ls.map((l) => (l.pieceId && l.prixCatalogueHT !== null ? { ...l, prixUnitaireHT: String(appliquerRemisePro(l.prixCatalogueHT, remisePct)) } : l)));
  }

  async function soumettre(emettre = true) {
    setErreur(null);
    if (!client) return setErreur("Choisissez le client.");
    if (lignes.length === 0) return setErreur("Ajoutez au moins une ligne.");
    if (lignes.some((l) => !l.designation.trim() || num(l.quantite) <= 0)) return setErreur("Chaque ligne doit avoir une désignation et une quantité positive.");
    if (a.erreur) return setErreur(a.erreur);
    setPending(true);
    try {
      const corps = {
        dateEcheance: echeance || undefined,
        lignes: lignes.map((l) => ({
          ...(l.id ? { id: l.id } : {}),
          type: l.type,
          designation: l.designation.trim(),
          quantite: num(l.quantite),
          prixUnitaireHT: num(l.prixUnitaireHT),
          tvaRate: num(l.tvaRate),
          pieceId: l.pieceId,
          prixCatalogueHT: l.type === "PIECE" && l.prixCatalogueHT !== null && client.remisePct > 0 ? l.prixCatalogueHT : null,
        })),
        ...payloadOptions(options),
      };
      if (brouillon) {
        await api(`/api/factures/${brouillon.id}`, "PUT", corps);
        if (!emettre) {
          toast.success("Brouillon enregistré");
          setPending(false);
          return router.refresh();
        }
        const r = await api<{ id: string; numero: string }>(`/api/factures/${brouillon.id}/emettre`, "POST");
        toast.success(`Facture ${r.numero} émise`);
        return router.refresh();
      }
      const r = await api<{ id: string; numero: string }>("/api/factures/manuelle", "POST", { clientId: client.id, ...corps });
      toast.success(`Facture ${r.numero} émise`);
      router.push(`/factures/${r.id}`);
    } catch (e) {
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
                    {formatEUR(p.prixVenteHT)} · stock {p.stock}
                  </span>
                </span>
              )}
              onPick={ajouterPiece}
            />
          </div>
          {lignes.length === 0 && <p className="text-sm text-muted-foreground">Aucune ligne. Ajoutez une pièce du stock ou une ligne libre.</p>}
          {lignes.map((l) => (
            <div key={l.key} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 md:grid-cols-[9rem_1fr_6rem_8rem_6rem_auto]">
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
              <Field label="Qté" htmlFor={`qte-${l.key}`} hint={l.stock !== null ? `Stock : ${l.stock}` : undefined}>
                <Input id={`qte-${l.key}`} inputMode="decimal" value={l.quantite} onChange={(e) => maj(l.key, { quantite: e.target.value })} />
              </Field>
              <Field label="PU HT (€)" htmlFor={`pu-${l.key}`}>
                <Input id={`pu-${l.key}`} inputMode="decimal" value={l.prixUnitaireHT} onChange={(e) => maj(l.key, { prixUnitaireHT: e.target.value, prixCatalogueHT: l.pieceId ? l.prixCatalogueHT : null })} />
              </Field>
              <Field label="TVA %" htmlFor={`tva-${l.key}`}>
                <Input id={`tva-${l.key}`} inputMode="decimal" value={l.tvaRate} onChange={(e) => maj(l.key, { tvaRate: e.target.value })} />
              </Field>
              <Button type="button" variant="ghost" size="icon" aria-label="Supprimer la ligne" onClick={() => setLignes((ls) => ls.filter((x) => x.key !== l.key))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(["MAIN_OEUVRE", "FORFAIT", "FRAIS_DIVERS"] as const).map((t) => (
              <Button key={t} type="button" variant="outline" size="sm" onClick={() => ajouterLibre(t)}>
                <Plus aria-hidden />
                {TYPES[t]}
              </Button>
            ))}
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
      <div className="flex justify-end gap-2">
        {brouillon ? (
          <Button type="button" variant="outline" onClick={() => soumettre(false)} disabled={pending}>
            Enregistrer le brouillon
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => router.push("/factures")} disabled={pending}>
            Annuler
          </Button>
        )}
        <Button type="button" onClick={() => soumettre(true)} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Émettre la facture
        </Button>
      </div>
    </div>
  );
}
