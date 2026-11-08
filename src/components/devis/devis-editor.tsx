"use client";

import { AlertTriangle, Car, Loader2, PackagePlus, Save, Send, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClientForm, type ClientCree } from "@/components/clients/client-form";
import { VehiculeForm, type VehiculeSaved } from "@/components/clients/vehicule-form";
import { NouvellePieceDialog, type PieceCreee } from "@/components/devis/nouvelle-piece-dialog";
import { SearchPicker } from "@/components/devis/search-picker";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { appliquerRemisePro, calculerTotaux, formatEUR, round2, totalLigneHT } from "@/lib/money";
import { tauxRemiseLigne } from "@/lib/remise";
import { devisSchema } from "@/lib/validators/devis";

type TypeLigne = "MAIN_OEUVRE" | "FORFAIT" | "PIECE" | "FRAIS_DIVERS";

interface LigneState {
  key: string;
  type: TypeLigne;
  designation: string;
  quantite: string;
  /** Prix unitaire HT : c'est lui qui est enregistré en base. */
  prixUnitaireHT: string;
  /** Prix unitaire TTC affiché et saisi à l'écran ; le HT en est déduit (arrondi au centime). */
  prixTTC: string;
  tvaRate: string;
  pieceId: string | null;
  stock: number | null;
  /** Seuil d'alerte de la pièce du stock (alerte si le devis fait passer le stock dessous). */
  seuilAlerte?: number | null;
  prixAchatHT?: number;
  /** Prix catalogue de la pièce avant réduction professionnelle (sert au recalcul et à la traçabilité). */
  prixCatalogueHT: number | null;
  /** true dès que le prix unitaire a été saisi à la main : la remise automatique ne le touche plus. */
  prixManuel: boolean;
  /** Forfait des tarifs : ses pièces sont décrémentées du stock à la validation du devis. */
  tarifId?: string | null;
  piecesComprises?: { reference: string; nom: string; quantite: number }[];
}

export interface ClientLite {
  id: string;
  type: "PARTICULIER" | "PRO";
  nom: string;
  discountRate: number;
}

export interface VehiculeLite {
  id: string;
  clientId: string | null;
  immatriculation: string;
  marque: string;
  modele: string;
  vin: string | null;
  kilometrage: number | null;
  prochainCT: string | null;
}

export interface DevisInitial {
  id?: string;
  type: "MECANIQUE" | "PIECE";
  client: ClientLite | null;
  vehicule: VehiculeLite | null;
  kilometrage: number | null;
  prochainCT: string;
  dateValidite: string;
  priseEnCompteSeuil?: boolean;
  lignes: Omit<LigneState, "key" | "prixTTC">[];
}

interface Tarif {
  id: string;
  type: string;
  libelle: string;
  montantHT: number;
  pieces?: { reference: string; nom: string; quantite: number }[];
}

interface PieceHit {
  id: string;
  reference: string;
  nom: string;
  prixVenteHT: number;
  stock: number;
  seuilAlerte?: number;
  prixAchatHT?: number;
  /** Référence croisée saisie : la pièce en est l'équivalent (référence principale = `reference`). */
  referenceCroisee?: string | null;
}

interface ClientHit {
  id: string;
  type: "PARTICULIER" | "PRO";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  discountRate: number;
}

interface VehiculeHit extends VehiculeLite {
  annee: number | null;
  motorisation: string | null;
  client: ClientHit | null;
}

const TYPE_LABEL: Record<TypeLigne, string> = { MAIN_OEUVRE: "Main d'œuvre", FORFAIT: "Forfait", PIECE: "Pièce", FRAIS_DIVERS: "Frais divers" };
let compteur = 0;
const nouvelleCle = () => `l${++compteur}`;
const num = (s: string) => (s.trim() === "" ? 0 : Number(s.replace(",", ".")));
/** TVA par défaut des lignes (taux normal). */
const TVA = 20;
const versTTC = (ht: number, taux: number) => round2(ht * (1 + taux / 100));
const versHT = (ttc: number, taux: number) => round2(ttc / (1 + taux / 100));
/** Prix HT fixé par le programme (catalogue, tarif, remise) : le prix TTC affiché suit. */
const avecHT = (ht: number, taux: number) => ({ prixUnitaireHT: String(ht), prixTTC: String(versTTC(ht, taux)) });
const nomClientHit = (c: ClientHit) => (c.type === "PRO" && c.companyName ? c.companyName : [c.firstName, c.lastName].filter(Boolean).join(" "));
/** Réduction professionnelle : recalcule les seules lignes « Pièce » du stock dont le prix n'a pas été modifié à la main. */
function reappliquerRemise(lignes: LigneState[], taux: number): LigneState[] {
  return lignes.map((l) =>
    l.type === "PIECE" && l.pieceId && l.prixCatalogueHT !== null && !l.prixManuel ? { ...l, ...avecHT(appliquerRemisePro(l.prixCatalogueHT, taux), num(l.tvaRate)) } : l,
  );
}
const libelleVehicule = (v: Pick<VehiculeLite, "marque" | "modele" | "immatriculation">) => `${v.marque} ${v.modele} · ${v.immatriculation}`;

export function DevisEditor({ initial, tarifs, voirMarges, voirAchat = false, statut }: { initial: DevisInitial; tarifs: Tarif[]; voirMarges: boolean; voirAchat?: boolean; statut?: "BROUILLON" | "ENVOYE" }) {
  const router = useRouter();
  const [type, setType] = useState(initial.type);
  const [client, setClient] = useState(initial.client);
  const [vehicules, setVehicules] = useState<VehiculeLite[]>(initial.vehicule ? [initial.vehicule] : []);
  const [vehiculeId, setVehiculeId] = useState(initial.vehicule?.id ?? "");
  const [kilometrage, setKilometrage] = useState(initial.kilometrage != null ? String(initial.kilometrage) : "");
  const [prochainCT, setProchainCT] = useState(initial.prochainCT);
  const [nouveauVehicule, setNouveauVehicule] = useState(false);
  const [nouveauClient, setNouveauClient] = useState(false);
  const [dateValidite, setDateValidite] = useState(initial.dateValidite);
  const [lignes, setLignes] = useState<LigneState[]>(initial.lignes.map((l) => ({ ...l, key: nouvelleCle(), prixTTC: String(versTTC(num(l.prixUnitaireHT), num(l.tvaRate))) })));
  const [seuil, setSeuil] = useState(initial.priseEnCompteSeuil ?? true);
  const [nouvellePiece, setNouvellePiece] = useState(false);
  const [saving, setSaving] = useState<"brouillon" | "envoi" | null>(null);

  const remise = client?.type === "PRO" ? client.discountRate : 0;
  const clientId = client?.id;

  // Véhicules du client sélectionné (en plus du véhicule déjà choisi).
  useEffect(() => {
    if (!clientId) return;
    let annule = false;
    api<VehiculeHit[]>(`/api/vehicules?clientId=${clientId}`, "GET")
      .then((v) =>
        !annule &&
        setVehicules((courants) => {
          const ids = new Set(v.map((x) => x.id));
          return [...v, ...courants.filter((c) => !ids.has(c.id))];
        }),
      )
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [clientId]);

  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);
  const fetchVehicules = useCallback(async (q: string) => api<VehiculeHit[]>(`/api/vehicules?q=${encodeURIComponent(q)}`, "GET"), []);
  const fetchPieces = useCallback(async (q: string) => (await api<{ items: PieceHit[] }>(`/api/stock?q=${encodeURIComponent(q)}`, "GET")).items, []);

  const totaux = useMemo(
    () => calculerTotaux(lignes.map((l) => ({ quantite: num(l.quantite), prixUnitaireHT: num(l.prixUnitaireHT), tvaRate: num(l.tvaRate) }))),
    [lignes],
  );

  const demandes = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lignes) if (l.pieceId) m.set(l.pieceId, (m.get(l.pieceId) ?? 0) + num(l.quantite));
    return m;
  }, [lignes]);
  /** Alerte de stock d'une ligne (non bloquante) : rupture, ou passage sous le seuil d'alerte si l'option est cochée. */
  const alerteStock = (l: LigneState): { niveau: "rupture" | "seuil"; texte: string } | null => {
    if (!l.pieceId || l.stock === null) return null;
    const reste = l.stock - (demandes.get(l.pieceId) ?? 0);
    if (reste < 0) return { niveau: "rupture", texte: `Stock insuffisant : ${l.stock} disponible, il manquera ${-reste} pièce${reste < -1 ? "s" : ""}` };
    if (seuil && l.seuilAlerte != null && l.seuilAlerte > 0 && reste <= l.seuilAlerte) return { niveau: "seuil", texte: `Stock restant après ce devis : ${reste} (seuil d'alerte : ${l.seuilAlerte})` };
    return null;
  };
  const horsStock = lignes.filter((l) => alerteStock(l)?.niveau === "rupture");
  const sousSeuil = lignes.filter((l) => alerteStock(l)?.niveau === "seuil");

  const marge = useMemo(() => {
    if (!voirMarges) return null;
    let m = 0;
    for (const l of lignes) {
      if (l.type === "PIECE" && l.prixAchatHT !== undefined) m += (num(l.prixUnitaireHT) - l.prixAchatHT) * num(l.quantite);
    }
    return round2(m);
  }, [lignes, voirMarges]);

  function maj(key: string, patch: Partial<LigneState>) {
    setLignes((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function ajouterLibre(t: TypeLigne) {
    setLignes((ls) => [...ls, { key: nouvelleCle(), type: t, designation: "", quantite: "1", ...avecHT(0, TVA), tvaRate: String(TVA), pieceId: null, stock: null, prixCatalogueHT: null, prixManuel: true }]);
  }

  function ajouterTarif(t: TypeLigne, tarifId: string) {
    const tarif = tarifs.find((x) => x.id === tarifId);
    if (!tarif) return;
    setLignes((ls) => [
      ...ls,
      { key: nouvelleCle(), type: t, designation: tarif.libelle, quantite: "1", ...avecHT(tarif.montantHT, TVA), tvaRate: String(TVA), pieceId: null, stock: null, prixCatalogueHT: null, prixManuel: true, tarifId: t === "FORFAIT" ? tarif.id : null, piecesComprises: t === "FORFAIT" ? tarif.pieces : undefined },
    ]);
  }

  function ajouterPiece(p: PieceHit | PieceCreee) {
    const pu = appliquerRemisePro(p.prixVenteHT, remise);
    setLignes((ls) => [
      ...ls,
      { key: nouvelleCle(), type: "PIECE", designation: `${p.nom} (${p.reference})`, quantite: "1", ...avecHT(pu, TVA), tvaRate: String(TVA), pieceId: p.id, stock: p.stock, seuilAlerte: p.seuilAlerte ?? null, prixAchatHT: voirMarges ? p.prixAchatHT : undefined, prixCatalogueHT: p.prixVenteHT, prixManuel: false },
    ]);
  }

  /** Saisie du prix TTC : le HT enregistré en est déduit. */
  function majTTC(l: LigneState, v: string) {
    maj(l.key, { prixTTC: v, prixUnitaireHT: String(versHT(num(v), num(l.tvaRate))), prixManuel: true });
  }

  /** Changement de TVA : le prix TTC saisi est conservé, le HT est recalculé. */
  function majTVA(l: LigneState, v: string) {
    maj(l.key, { tvaRate: v, prixUnitaireHT: String(versHT(num(l.prixTTC), num(v))) });
  }

  function selectionnerVehicule(v: VehiculeLite | null) {
    if (!v) {
      setVehiculeId("");
      return;
    }
    setVehicules((courants) => (courants.some((c) => c.id === v.id) ? courants.map((c) => (c.id === v.id ? v : c)) : [...courants, v]));
    setVehiculeId(v.id);
    setKilometrage(v.kilometrage != null ? String(v.kilometrage) : "");
    setProchainCT(v.prochainCT ?? "");
  }

  /** Recherche par plaque / VIN : le véhicule trouvé renseigne aussi son propriétaire. */
  /** Change de client et applique (ou retire) automatiquement sa réduction sur les pièces. */
  function definirClient(c: ClientLite) {
    setClient(c);
    setLignes((ls) => reappliquerRemise(ls, c.type === "PRO" ? c.discountRate : 0));
  }

  function choisirVehiculeTrouve(v: VehiculeHit) {
    if (v.client) definirClient({ id: v.client.id, type: v.client.type, nom: nomClientHit(v.client), discountRate: Number(v.client.discountRate) });
    selectionnerVehicule(v);
  }

  function choisirClient(c: ClientHit) {
    definirClient({ id: c.id, type: c.type, nom: nomClientHit(c), discountRate: Number(c.discountRate) });
    // Un véhicule d'un autre propriétaire est retiré de la sélection.
    const courant = vehicules.find((v) => v.id === vehiculeId);
    if (courant && courant.clientId && courant.clientId !== c.id) setVehiculeId("");
  }

  /** Client créé à la volée : enregistré en base, puis sélectionné pour ce devis. */
  function clientCree(c: ClientCree) {
    setNouveauClient(false);
    definirClient({ id: c.id, type: c.type, nom: c.nom, discountRate: c.discountRate });
    const courant = vehicules.find((v) => v.id === vehiculeId);
    if (courant && courant.clientId && courant.clientId !== c.id) setVehiculeId("");
  }

  function vehiculeCree(v: VehiculeSaved) {
    setNouveauVehicule(false);
    selectionnerVehicule(v);
  }

  /** Enregistre le devis. « Brouillon » : statut Brouillon. « Envoi » : enregistre puis envoie le PDF au client par e-mail. */
  async function enregistrer(mode: "brouillon" | "envoi") {
    const payload = {
      type,
      clientId: client?.id ?? "",
      vehiculeId: vehiculeId || null,
      kilometrage: kilometrage.trim() === "" ? null : Number(kilometrage),
      prochainCT: prochainCT || null,
      dateValidite,
      priseEnCompteSeuil: seuil,
      brouillon: mode === "brouillon",
      lignes: lignes.map((l) => ({
        type: l.type,
        designation: l.designation,
        quantite: num(l.quantite),
        prixUnitaireHT: num(l.prixUnitaireHT),
        tvaRate: num(l.tvaRate),
        pieceId: l.pieceId,
        prixCatalogueHT: l.type === "PIECE" ? l.prixCatalogueHT : null,
        tarifId: l.type === "FORFAIT" ? (l.tarifId ?? null) : null,
      })),
    };
    if (!client) return void toast.error("Sélectionnez un client.");
    const parsed = devisSchema.safeParse(payload);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Devis invalide");
    // Stock insuffisant : alerte seulement, l'enregistrement n'est pas bloqué.
    if (horsStock.length) toast.warning("Attention : stock insuffisant pour au moins une pièce. Le devis est enregistré quand même.");
    setSaving(mode);
    let id = initial.id;
    try {
      if (id) {
        await api(`/api/devis/${id}`, "PATCH", parsed.data);
      } else {
        const r = await api<{ id: string; numero: string }>("/api/devis", "POST", parsed.data);
        id = r.id;
      }
    } catch (e) {
      setSaving(null);
      return void toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    if (mode === "brouillon") {
      toast.success("Devis enregistré en brouillon");
    } else {
      try {
        await api(`/api/devis/${id}/envoyer`, "POST");
        toast.success("Devis enregistré et envoyé au client par e-mail");
      } catch (e) {
        toast.error(`Devis enregistré, mais non envoyé : ${e instanceof Error ? e.message : "erreur inconnue"}`);
      }
    }
    setSaving(null);
    if (initial.id) router.refresh();
    else router.push(`/devis/${id}`);
  }

  const tarifsDe = (t: TypeLigne) => tarifs.filter((x) => (t === "MAIN_OEUVRE" ? x.type.startsWith("MO") : x.type === t));
  const vehiculeChoisi = vehicules.find((v) => v.id === vehiculeId);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Véhicule {type === "PIECE" && <span className="text-xs font-normal text-muted-foreground">(facultatif)</span>}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type de devis" htmlFor="type-devis">
                <NativeSelect id="type-devis" value={type} onChange={(e) => setType(e.target.value as "MECANIQUE" | "PIECE")}>
                  <option value="MECANIQUE">Mécanique</option>
                  <option value="PIECE">Vente de pièces</option>
                </NativeSelect>
              </Field>
              <Field label="Valable jusqu'au" htmlFor="validite">
                <Input id="validite" type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} />
              </Field>
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchPicker<VehiculeHit>
                  label="Rechercher un véhicule par plaque, VIN ou client"
                  placeholder="Plaque, VIN ou nom du client…"
                  fetcher={fetchVehicules}
                  getKey={(v) => v.id}
                  renderItem={(v) => (
                    <span className="flex justify-between gap-3">
                      <span>
                        <b>{v.immatriculation}</b> · {v.marque} {v.modele}
                      </span>
                      <span className="text-muted-foreground">{v.client ? nomClientHit(v.client) : "Sans client"}</span>
                    </span>
                  )}
                  onPick={choisirVehiculeTrouve}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setNouveauVehicule(true)}>
                <Car aria-hidden />
                Nouveau véhicule
              </Button>
            </div>
            <Field label="Véhicule sélectionné" htmlFor="vehicule">
              <NativeSelect id="vehicule" value={vehiculeId} onChange={(e) => selectionnerVehicule(vehicules.find((v) => v.id === e.target.value) ?? null)}>
                <option value="">{type === "PIECE" ? "Aucun véhicule" : "Sélectionner un véhicule…"}</option>
                {vehicules.map((v) => (
                  <option key={v.id} value={v.id}>
                    {libelleVehicule(v)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {vehiculeChoisi && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kilométrage" htmlFor="km">
                  <Input id="km" type="number" inputMode="numeric" min={0} value={kilometrage} onChange={(e) => setKilometrage(e.target.value)} />
                </Field>
                <Field label="Prochain contrôle technique" htmlFor="ct">
                  <Input id="ct" type="date" value={prochainCT} onChange={(e) => setProchainCT(e.target.value)} />
                </Field>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client ? (
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="font-medium">{client.nom}</span>
                {remise > 0 && <span className="text-xs text-success">Remise pro {remise} % sur les pièces</span>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choisissez un client, ou trouvez-le via la plaque du véhicule.</p>
            )}
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchPicker<ClientHit>
                  label="Rechercher un client"
                  placeholder={client ? "Changer de client…" : "Nom, société, téléphone ou plaque…"}
                  fetcher={fetchClients}
                  getKey={(c) => c.id}
                  renderItem={(c) => <span>{nomClientHit(c)}</span>}
                  onPick={choisirClient}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setNouveauClient(true)}>
                <UserPlus aria-hidden />
                Nouveau client
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Lignes</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(["FORFAIT", "MAIN_OEUVRE", "FRAIS_DIVERS"] as const).map((t) => (
              <NativeSelect
                key={t}
                aria-label={`Ajouter : ${TYPE_LABEL[t]}`}
                className="h-8 w-44 text-xs"
                value=""
                onChange={(e) => {
                  if (e.target.value === "__libre") ajouterLibre(t);
                  else if (e.target.value) ajouterTarif(t, e.target.value);
                }}
              >
                <option value="">+ {TYPE_LABEL[t]}</option>
                {tarifsDe(t).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.libelle} ({formatEUR(versTTC(x.montantHT, TVA))} TTC)
                  </option>
                ))}
                <option value="__libre">Ligne libre…</option>
              </NativeSelect>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex max-w-2xl flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
            <SearchPicker<PieceHit>
              label="Ajouter une pièce du stock"
              placeholder="Ajouter une pièce (référence, nom, pneu…)"
              fetcher={fetchPieces}
              getKey={(p) => p.id}
              renderItem={(p) => (
                <span className="flex justify-between gap-3">
                  <span>
                    <b>{p.reference}</b> · {p.nom}
                    {p.referenceCroisee && <span className="block text-xs text-muted-foreground">Équivalent de {p.referenceCroisee}</span>}
                  </span>
                  <span className={p.stock <= 0 ? "text-destructive" : "text-muted-foreground"}>
                    {formatEUR(versTTC(p.prixVenteHT, TVA))} TTC · stock {p.stock}
                  </span>
                </span>
              )}
              onPick={ajouterPiece}
            />
            </div>
            <Button type="button" variant="outline" onClick={() => setNouvellePiece(true)}>
              <PackagePlus aria-hidden />
              Nouvelle pièce
            </Button>
          </div>
          <label className="flex w-fit items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={seuil} onChange={(e) => setSeuil(e.target.checked)} />
            Prendre en compte le seuil d&apos;alerte des pièces
            <span className="text-xs text-muted-foreground">(alerte ici et bon de commande automatique à la validation)</span>
          </label>
          {(horsStock.length > 0 || sousSeuil.length > 0) && (
            <div role="status" className="flex gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                {horsStock.length > 0 && <>Stock insuffisant pour {horsStock.length} pièce{horsStock.length > 1 ? "s" : ""} : le devis peut quand même être enregistré et validé (le stock deviendra négatif). </>}
                {sousSeuil.length > 0 && <>{sousSeuil.length} pièce{sousSeuil.length > 1 ? "s passeront" : " passera"} sous le seuil d&apos;alerte.</>}
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="rounded-l-lg px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Désignation</th>
                  <th className="w-20 px-2 py-2 font-medium">Qté</th>
                  <th className="w-28 px-2 py-2 font-medium">PU TTC</th>
                  <th className="w-20 px-2 py-2 font-medium">TVA %</th>
                  <th className="w-28 px-2 py-2 text-right font-medium">Total TTC</th>
                  {voirMarges && <th className="w-24 px-2 py-2 text-right font-medium">Marge HT</th>}
                  <th className="w-10 rounded-r-lg px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={voirMarges ? 8 : 7} className="py-8 text-center text-muted-foreground">
                      Ajoutez un forfait, de la main d&apos;œuvre ou une pièce.
                    </td>
                  </tr>
                )}
                {lignes.map((l) => {
                  const alerte = alerteStock(l);
                  const m = l.type === "PIECE" && l.prixAchatHT !== undefined ? round2((num(l.prixUnitaireHT) - l.prixAchatHT) * num(l.quantite)) : null;
                  return (
                    <tr key={l.key} className="border-b align-top">
                      <td className="px-2 py-2 text-xs text-muted-foreground">{TYPE_LABEL[l.type]}</td>
                      <td className="px-2 py-1.5">
                        <Input aria-label="Désignation" value={l.designation} maxLength={200} onChange={(e) => maj(l.key, { designation: e.target.value })} />
                        {alerte && <p className={alerte.niveau === "rupture" ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-warning"}>{alerte.texte}</p>}
                        {l.piecesComprises && l.piecesComprises.length > 0 && (
                          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                            Pièces comprises (déduites du stock à la validation) : {l.piecesComprises.map((p) => `${p.nom} (${p.reference}) × ${p.quantite}`).join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label="Quantité" inputMode="decimal" value={l.quantite} onChange={(e) => maj(l.key, { quantite: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label="Prix unitaire TTC" inputMode="decimal" value={l.prixTTC} onChange={(e) => majTTC(l, e.target.value)} />
                        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{formatEUR(num(l.prixUnitaireHT))} HT</p>
                        {l.type === "PIECE" && l.prixCatalogueHT !== null && tauxRemiseLigne({ prixUnitaireHT: num(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT }) > 0 && (
                          <p className="mt-1 text-[11px] leading-tight text-success">
                            Catalogue {formatEUR(versTTC(l.prixCatalogueHT, num(l.tvaRate)))} TTC · remise {tauxRemiseLigne({ prixUnitaireHT: num(l.prixUnitaireHT), prixCatalogueHT: l.prixCatalogueHT })} %
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label="Taux de TVA" inputMode="decimal" value={l.tvaRate} onChange={(e) => majTVA(l, e.target.value)} />
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{formatEUR(versTTC(totalLigneHT({ quantite: num(l.quantite), prixUnitaireHT: num(l.prixUnitaireHT) }), num(l.tvaRate)))}</td>
                      {voirMarges && <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">{m === null ? "–" : formatEUR(m)}</td>}
                      <td className="px-1 py-1.5">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer la ligne" onClick={() => setLignes((ls) => ls.filter((x) => x.key !== l.key))}>
                          <Trash2 aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-80 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span className="tabular-nums">{formatEUR(totaux.totalHT)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA</span>
              <span className="tabular-nums">{formatEUR(totaux.totalTVA)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <span>Total TTC</span>
              <span className="tabular-nums">{formatEUR(totaux.totalTTC)}</span>
            </div>
            {marge !== null && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Marge sur pièces</span>
                <span className="tabular-nums">{formatEUR(marge)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="button" variant="outline" onClick={() => enregistrer("brouillon")} disabled={saving !== null}>
          {saving === "brouillon" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Enregistrer en brouillon
        </Button>
        <Button type="button" onClick={() => enregistrer("envoi")} disabled={saving !== null}>
          {saving === "envoi" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {statut === "ENVOYE" ? "Enregistrer et renvoyer" : "Enregistrer et envoyer"}
        </Button>
      </div>
      {statut === "ENVOYE" && <p className="text-right text-xs text-muted-foreground">Ce devis a déjà été envoyé : « Enregistrer en brouillon » le repasse en brouillon, à renvoyer au client.</p>}

      <NouvellePieceDialog open={nouvellePiece} onOpenChange={setNouvellePiece} voirAchat={voirAchat} onCreee={ajouterPiece} />

      <Dialog open={nouveauClient} onOpenChange={setNouveauClient}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>Le client est enregistré puis sélectionné automatiquement pour ce devis.</DialogDescription>
          </DialogHeader>
          <ClientForm onSaved={clientCree} onCancel={() => setNouveauClient(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={nouveauVehicule} onOpenChange={setNouveauVehicule}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouveau véhicule</DialogTitle>
            <DialogDescription>Saisissez la plaque ou le VIN : le VIN retrouve les caractéristiques du véhicule.</DialogDescription>
          </DialogHeader>
          <VehiculeForm clientId={client?.id} clientNom={client?.nom} onSaved={vehiculeCree} onCancel={() => setNouveauVehicule(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
