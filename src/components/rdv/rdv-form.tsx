"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { CollaborateurSelect } from "@/components/rdv/collaborateur-select";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { rdvSchema } from "@/lib/validators/rdv";

interface DevisHit {
  id: string;
  numero: string;
  type: "MECANIQUE" | "PIECE";
  statut: string;
  clientId: string;
  vehiculeId: string | null;
  client: ClientHit;
  vehicule: { immatriculation: string; marque: string; modele: string } | null;
}

interface ClientHit {
  id: string;
  type: "PARTICULIER" | "PRO";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}

export interface RdvInitial {
  id?: string;
  devisId?: string | null;
  devisNumero?: string | null;
  clientId?: string;
  clientNom?: string;
  vehiculeId?: string;
  userId?: string;
  jour: string;
  debut: string;
  fin: string;
  motif?: string;
}

const nom = (c: ClientHit) => (c.type === "PRO" && c.companyName ? c.companyName : [c.firstName, c.lastName].filter(Boolean).join(" "));

export function RdvForm({ initial, collaborateurs, onDone }: { initial: RdvInitial; collaborateurs: { id: string; nom: string; couleur: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [client, setClient] = useState(initial.clientId ? { id: initial.clientId, nom: initial.clientNom ?? "" } : null);
  const [vehicules, setVehicules] = useState<{ id: string; label: string }[]>([]);
  const [vehiculeId, setVehiculeId] = useState(initial.vehiculeId ?? "");
  const [userId, setUserId] = useState(initial.userId ?? collaborateurs[0]?.id ?? "");
  const [jour, setJour] = useState(initial.jour);
  const [debut, setDebut] = useState(initial.debut);
  const [fin, setFin] = useState(initial.fin);
  const [motif, setMotif] = useState(initial.motif ?? "");
  const [devis, setDevis] = useState(initial.devisId ? { id: initial.devisId, numero: initial.devisNumero ?? "" } : null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clientId = client?.id;
  useEffect(() => {
    if (!clientId) return;
    let annule = false;
    api<{ id: string; immatriculation: string; marque: string; modele: string }[]>(`/api/vehicules?clientId=${clientId}`, "GET")
      .then((v) => !annule && setVehicules(v.map((x) => ({ id: x.id, label: `${x.marque} ${x.modele} · ${x.immatriculation}` }))))
      .catch(() => !annule && setVehicules([]));
    return () => {
      annule = true;
    };
  }, [clientId]);

  const fetchDevis = useCallback(async (q: string) => api<DevisHit[]>(`/api/devis?statut=ENVOYE&q=${encodeURIComponent(q)}`, "GET"), []);
  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const payload = { clientId: client?.id ?? "", vehiculeId, userId, devisId: devis?.id ?? null, debut: `${jour}T${debut}`, fin: `${jour}T${fin}`, motif };
    const parsed = rdvSchema.safeParse(payload);
    if (!parsed.success) return setErreur(parsed.error.issues[0]?.message ?? "Rendez-vous invalide");
    setPending(true);
    try {
      if (initial.id) await api(`/api/rendez-vous/${initial.id}`, "PUT", parsed.data);
      else await api("/api/rendez-vous", "POST", parsed.data);
      toast.success(initial.id ? "Rendez-vous déplacé" : "Rendez-vous créé");
      onDone();
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Devis en attente (facultatif)</span>
        {devis && (
          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="font-medium">{devis.numero}</span>
            <button type="button" className="text-xs text-link hover:underline" onClick={() => setDevis(null)}>
              Retirer
            </button>
          </div>
        )}
        <SearchPicker<DevisHit>
          label="Choisir un devis existant"
          placeholder="Choisir un devis en attente (numéro, client, plaque)…"
          fetcher={fetchDevis}
          getKey={(d) => d.id}
          renderItem={(d) => (
            <span className="flex justify-between gap-3">
              <span>
                <b>{d.numero}</b> · {nom(d.client)}
              </span>
              <span className="text-muted-foreground">{d.vehicule ? `${d.vehicule.immatriculation}` : "Pièces"}</span>
            </span>
          )}
          onPick={(d) => {
            setDevis({ id: d.id, numero: d.numero });
            setClient({ id: d.clientId, nom: nom(d.client) });
            setVehiculeId(d.vehiculeId ?? "");
            if (!motif.trim()) setMotif(`Devis ${d.numero}`);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Client</span>
        {client && <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">{client.nom}</div>}
        <SearchPicker<ClientHit>
          label="Rechercher un client"
          placeholder={client ? "Changer de client…" : "Rechercher un client…"}
          fetcher={fetchClients}
          getKey={(c) => c.id}
          renderItem={(c) => nom(c)}
          onPick={(c) => {
            setClient({ id: c.id, nom: nom(c) });
            setVehiculeId("");
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Véhicule" htmlFor="rdv-vehicule">
          <NativeSelect id="rdv-vehicule" value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)} disabled={!client}>
            <option value="">{client ? "Sélectionner…" : "Choisissez un client"}</option>
            {vehicules.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Collaborateur" htmlFor="rdv-user">
          <CollaborateurSelect id="rdv-user" label="Collaborateur" options={collaborateurs} value={userId} onChange={setUserId} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Jour" htmlFor="rdv-jour">
          <Input id="rdv-jour" type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
        </Field>
        <Field label="Début" htmlFor="rdv-debut">
          <Input id="rdv-debut" type="time" step={900} value={debut} onChange={(e) => setDebut(e.target.value)} />
        </Field>
        <Field label="Fin" htmlFor="rdv-fin">
          <Input id="rdv-fin" type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} />
        </Field>
      </div>
      <Field label="Motif" htmlFor="rdv-motif">
        <Input id="rdv-motif" value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)} placeholder="Révision, freins, diagnostic…" />
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
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {initial.id ? "Enregistrer" : "Créer le rendez-vous"}
        </Button>
      </div>
    </form>
  );
}
