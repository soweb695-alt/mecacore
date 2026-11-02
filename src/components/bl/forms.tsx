"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SearchPicker } from "@/components/devis/search-picker";
import { Field } from "@/components/forms/field";
import { useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

interface PieceHit {
  id: string;
  reference: string;
  nom: string;
  stock: number;
  referenceCroisee?: string | null;
}
interface Ligne {
  pieceId: string;
  libelle: string;
  quantite: string;
}

function LignesPieces({ lignes, setLignes }: { lignes: Ligne[]; setLignes: (l: Ligne[]) => void }) {
  const fetchPieces = useCallback(async (q: string) => (await api<{ items: PieceHit[] }>(`/api/stock?q=${encodeURIComponent(q)}`, "GET")).items, []);
  return (
    <div className="space-y-2">
      <SearchPicker<PieceHit>
        label="Ajouter une pièce"
        placeholder="Ajouter une pièce (référence, nom…)"
        fetcher={fetchPieces}
        getKey={(p) => p.id}
        renderItem={(p) => (
          <span>
            <b>{p.reference}</b> · {p.nom} <span className="text-muted-foreground">(stock {p.stock})</span>
            {p.referenceCroisee && <span className="block text-xs text-muted-foreground">Équivalent de {p.referenceCroisee}</span>}
          </span>
        )}
        onPick={(p) => !lignes.some((l) => l.pieceId === p.id) && setLignes([...lignes, { pieceId: p.id, libelle: `${p.reference} · ${p.nom}`, quantite: "1" }])}
      />
      {lignes.map((l) => (
        <div key={l.pieceId} className="flex items-center gap-2">
          <span className="flex-1 truncate text-sm">{l.libelle}</span>
          <Input
            aria-label={`Quantité de ${l.libelle}`}
            className="w-20"
            inputMode="numeric"
            value={l.quantite}
            onChange={(e) => setLignes(lignes.map((x) => (x.pieceId === l.pieceId ? { ...x, quantite: e.target.value } : x)))}
          />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer la ligne" onClick={() => setLignes(lignes.filter((x) => x.pieceId !== l.pieceId))}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
    </div>
  );
}

const toPayload = (lignes: Ligne[]) => lignes.map((l) => ({ pieceId: l.pieceId, quantite: Number(l.quantite) }));

export function BonCommandeForm({ bc }: { bc?: { id: string; fournisseur: string; lignes: { pieceId: string; libelle: string; quantite: number }[] } }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [fournisseur, setFournisseur] = useState(bc?.fournisseur === "À définir" ? "" : (bc?.fournisseur ?? ""));
  const [lignes, setLignes] = useState<Ligne[]>(bc?.lignes.map((l) => ({ ...l, quantite: String(l.quantite) })) ?? []);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          if (bc) {
            await api(`/api/bons-commande/${bc.id}`, "PATCH", { fournisseur, lignes: toPayload(lignes) });
            toast.success("Bon de commande mis à jour");
          } else {
            const r = await api<{ numero: string }>("/api/bons-commande", "POST", { fournisseur, lignes: toPayload(lignes) });
            toast.success(`Bon de commande ${r.numero} créé`);
          }
          close();
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Field label="Fournisseur" htmlFor="fournisseur">
        <Input id="fournisseur" value={fournisseur} maxLength={100} onChange={(e) => setFournisseur(e.target.value)} />
      </Field>
      <LignesPieces lignes={lignes} setLignes={setLignes} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || !fournisseur.trim() || lignes.length === 0}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {bc ? "Enregistrer" : "Créer le bon de commande"}
        </Button>
      </div>
    </form>
  );
}

interface ClientHit {
  id: string;
  type: "PARTICULIER" | "PRO";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}

export function BonLivraisonForm() {
  const router = useRouter();
  const close = useCloseDialog();
  const [client, setClient] = useState<{ id: string; nom: string } | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [pending, setPending] = useState(false);
  const fetchClients = useCallback(async (q: string) => (await api<{ items: ClientHit[] }>(`/api/clients?q=${encodeURIComponent(q)}`, "GET")).items, []);
  const nom = (c: ClientHit) => (c.type === "PRO" && c.companyName ? c.companyName : [c.firstName, c.lastName].filter(Boolean).join(" "));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!client) return;
        setPending(true);
        try {
          const r = await api<{ numero: string }>("/api/bons-livraison", "POST", { clientId: client.id, lignes: toPayload(lignes) });
          toast.success(`Bon de livraison ${r.numero} créé`);
          close();
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Client</span>
        {client && <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">{client.nom}</div>}
        <SearchPicker<ClientHit> label="Rechercher un client" placeholder="Rechercher un client…" fetcher={fetchClients} getKey={(c) => c.id} renderItem={nom} onPick={(c) => setClient({ id: c.id, nom: nom(c) })} />
      </div>
      <LignesPieces lignes={lignes} setLignes={setLignes} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || !client || lignes.length === 0}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          <Plus aria-hidden />
          Créer le bon de livraison
        </Button>
      </div>
    </form>
  );
}

export function ReceptionForm({ bonCommandeId, lignes }: { bonCommandeId: string; lignes: { id: string; libelle: string; commande: number; recue: number }[] }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [q, setQ] = useState<Record<string, string>>(Object.fromEntries(lignes.map((l) => [l.id, String(l.commande - l.recue)])));
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await api(`/api/bons-commande/${bonCommandeId}/reception`, "POST", { lignes: lignes.map((l) => ({ ligneId: l.id, quantite: Number(q[l.id] || 0) })) });
          toast.success("Réception enregistrée, stock mis à jour");
          close();
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      {lignes.map((l) => (
        <div key={l.id} className="flex items-center gap-3 text-sm">
          <span className="flex-1">
            {l.libelle}
            <span className="block text-xs text-muted-foreground">
              Commandé {l.commande} · déjà reçu {l.recue}
            </span>
          </span>
          <Input aria-label={`Quantité reçue : ${l.libelle}`} className="w-20" inputMode="numeric" value={q[l.id]} onChange={(e) => setQ({ ...q, [l.id]: e.target.value })} />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          Enregistrer la réception
        </Button>
      </div>
    </form>
  );
}
