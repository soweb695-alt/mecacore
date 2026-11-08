"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { LABELS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { nomClient } from "@/lib/format";
import { retourSchema, STATUTS_RETOUR, TYPES_RETOUR } from "@/lib/validators/retour";

interface ClientHit {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}

interface OrdreHit {
  id: string;
  numero: string;
  client: ClientHit;
  vehicule: { immatriculation: string; marque: string; modele: string } | null;
}

interface PieceHit {
  id: string;
  reference: string;
  nom: string;
  fournisseur: string | null;
}

export interface RetourFormValeur {
  id: string;
  type: (typeof TYPES_RETOUR)[number];
  statut: (typeof STATUTS_RETOUR)[number];
  designation: string;
  reference: string;
  quantite: number;
  montantConsigneHT: number | null;
  fournisseur: string;
  notes: string;
  dateEntree: string;
  client: { id: string; nom: string } | null;
  ordre: { id: string; numero: string } | null;
  piece: { id: string; libelle: string } | null;
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

/** Création / modification d'un retour ou d'une pièce consignée. */
export function RetourForm({ retour, aujourdhui }: { retour?: RetourFormValeur; aujourdhui: string }) {
  const router = useRouter();
  const onDone = useCloseDialog();
  const [type, setType] = useState(retour?.type ?? "PIECE_DEPOSEE");
  const [statut, setStatut] = useState(retour?.statut ?? "EN_ATTENTE");
  const [designation, setDesignation] = useState(retour?.designation ?? "");
  const [reference, setReference] = useState(retour?.reference ?? "");
  const [quantite, setQuantite] = useState(String(retour?.quantite ?? 1));
  const [montant, setMontant] = useState(retour?.montantConsigneHT != null ? String(retour.montantConsigneHT) : "");
  const [fournisseur, setFournisseur] = useState(retour?.fournisseur ?? "");
  const [notes, setNotes] = useState(retour?.notes ?? "");
  const [dateEntree, setDateEntree] = useState(retour?.dateEntree ?? aujourdhui);
  const [client, setClient] = useState(retour?.client ?? null);
  const [ordre, setOrdre] = useState(retour?.ordre ?? null);
  const [piece, setPiece] = useState(retour?.piece ?? null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);
  const clientId = client?.id;
  const fetchOrdres = useCallback(
    async (q: string) => api<OrdreHit[]>(`/api/retours/ordres?q=${encodeURIComponent(q)}${clientId ? `&clientId=${clientId}` : ""}`, "GET"),
    [clientId],
  );
  const fetchPieces = useCallback(async (q: string) => (await api<{ items: PieceHit[] }>(`/api/stock?q=${encodeURIComponent(q)}`, "GET")).items, []);

  function choisirPiece(p: PieceHit) {
    setPiece({ id: p.id, libelle: `${p.nom} (${p.reference})` });
    if (!designation.trim()) setDesignation(p.nom);
    if (!reference.trim()) setReference(p.reference);
    if (!fournisseur.trim() && p.fournisseur) setFournisseur(p.fournisseur);
  }

  function choisirOrdre(o: OrdreHit) {
    setOrdre({ id: o.id, numero: o.numero });
    // L'OR impose son client.
    setClient({ id: o.client.id, nom: nomClient(o.client) });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const parsed = retourSchema.safeParse({
      type,
      statut,
      designation,
      reference,
      quantite: num(quantite),
      montantConsigneHT: montant.trim() === "" ? null : num(montant),
      fournisseur,
      notes,
      dateEntree,
      clientId: client?.id ?? null,
      ordreId: ordre?.id ?? null,
      pieceId: piece?.id ?? null,
    });
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return setErreur(i?.code === "invalid_type" ? "Saisissez un nombre valide." : (i?.message ?? "Formulaire invalide"));
    }
    setPending(true);
    try {
      if (retour) await api(`/api/retours/${retour.id}`, "PATCH", parsed.data);
      else {
        const r = await api<{ numero: string }>("/api/retours", "POST", parsed.data);
        toast.success(`${r.numero} enregistré`);
      }
      if (retour) toast.success("Retour mis à jour");
      onDone();
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const lien = (libelle: string, retirer: () => void) => (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-sm">
      <span className="font-medium">{libelle}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer ${libelle}`} onClick={retirer}>
        <X aria-hidden />
      </Button>
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="r-type">
          <NativeSelect id="r-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPES_RETOUR.map((t) => (
              <option key={t} value={t}>
                {LABELS.typeRetour[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Statut" htmlFor="r-statut">
          <NativeSelect id="r-statut" value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)}>
            {STATUTS_RETOUR.map((t) => (
              <option key={t} value={t}>
                {LABELS.statutRetour[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Pièce du stock (facultatif)</span>
        {piece ? lien(piece.libelle, () => setPiece(null)) : (
          <SearchPicker<PieceHit>
            label="Rechercher une pièce du stock"
            placeholder="Référence ou nom de la pièce…"
            fetcher={fetchPieces}
            getKey={(p) => p.id}
            renderItem={(p) => <span><b>{p.reference}</b> · {p.nom}</span>}
            onPick={choisirPiece}
          />
        )}
      </div>

      <Field label="Désignation" htmlFor="r-designation">
        <Input id="r-designation" value={designation} maxLength={200} onChange={(e) => setDesignation(e.target.value)} placeholder={type === "CONSIGNE" ? "Alternateur échange standard…" : "Plaquettes usagées, ancien démarreur…"} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Référence" htmlFor="r-ref">
          <Input id="r-ref" className="uppercase" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Quantité" htmlFor="r-qte">
          <Input id="r-qte" type="number" min={1} step={1} value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </Field>
        <Field label="Date d'entrée" htmlFor="r-date">
          <Input id="r-date" type="date" value={dateEntree} onChange={(e) => setDateEntree(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fournisseur" htmlFor="r-fournisseur">
          <Input id="r-fournisseur" value={fournisseur} maxLength={80} onChange={(e) => setFournisseur(e.target.value)} />
        </Field>
        <Field label="Montant de la consigne HT (€)" htmlFor="r-montant" hint={type === "CONSIGNE" ? "À récupérer auprès du fournisseur" : "Facultatif"}>
          <Input id="r-montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Client (facultatif)</span>
          {client ? lien(client.nom, () => { setClient(null); setOrdre(null); }) : (
            <SearchPicker<ClientHit>
              label="Rechercher un client"
              placeholder="Nom, société, téléphone…"
              fetcher={fetchClients}
              getKey={(c) => c.id}
              renderItem={(c) => <span>{nomClient(c)}</span>}
              onPick={(c) => setClient({ id: c.id, nom: nomClient(c) })}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Ordre de réparation (facultatif)</span>
          {ordre ? lien(ordre.numero, () => setOrdre(null)) : (
            <SearchPicker<OrdreHit>
              label="Rechercher un ordre de réparation"
              placeholder="N° d'OR, client ou plaque…"
              fetcher={fetchOrdres}
              getKey={(o) => o.id}
              renderItem={(o) => (
                <span className="flex justify-between gap-3">
                  <b>{o.numero}</b>
                  <span className="text-muted-foreground">
                    {nomClient(o.client)}
                    {o.vehicule ? ` · ${o.vehicule.immatriculation}` : ""}
                  </span>
                </span>
              )}
              onPick={choisirOrdre}
            />
          )}
        </div>
      </div>

      <Field label="Notes" htmlFor="r-notes">
        <Textarea id="r-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="État de la pièce, n° de retour fournisseur…" />
      </Field>

      {erreur && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-destructive">
          {erreur}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <SubmitButton pending={pending}>{retour ? "Enregistrer" : "Créer"}</SubmitButton>
      </div>
    </form>
  );
}
