"use client";

import { Camera, CheckCircle2, Circle, Loader2, PenLine, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SignaturePad } from "@/components/or/signature-pad";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

interface Props {
  ordreId: string;
  statut: "EN_ATTENTE_SIGNATURE" | "SIGNE" | "EN_COURS" | "A_TRAITER_MAGASIN" | "FACTURE";
  taches: { id: string; designation: string; dureeHeures: number; terminee: boolean }[];
  photos: { id: string; url: string }[];
  signature: boolean;
  /** Kilométrage connu (devis ou véhicule) : pré-rempli à la fin des travaux. */
  kilometrage: number | null;
  /** La fin de l'OR exige une fiche de contrôle validée (transmise au Magasin). */
  ficheValidee: boolean;
  peutModifier: boolean;
}

export function OrdreTablette({ ordreId, statut, taches, photos, signature, kilometrage, ficheValidee, peutModifier }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [signOuvert, setSignOuvert] = useState(false);
  const [finOuverte, setFinOuverte] = useState(false);
  const [km, setKm] = useState(kilometrage != null ? String(kilometrage) : "");
  const [erreurFin, setErreurFin] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const termine = statut === "A_TRAITER_MAGASIN" || statut === "FACTURE";

  async function terminer() {
    setErreurFin(null);
    const valeur = Number(km.replace(/\s/g, ""));
    if (km.trim() === "" || !Number.isInteger(valeur) || valeur < 0) return setErreurFin("Indiquez le kilométrage relevé au compteur.");
    setPending(true);
    try {
      await api(`/api/ordres-reparation/${ordreId}/terminer`, "POST", { kilometrage: valeur });
      toast.success("Ordre terminé et transmis au Magasin");
      setFinOuverte(false);
      router.refresh();
    } catch (e) {
      setErreurFin(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function action<T>(fn: () => Promise<T>, ok?: string) {
    setPending(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function envoyerPhoto(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    fd.append("photo", f);
    await action(async () => {
      const res = await fetch(`/api/ordres-reparation/${ordreId}/photos`, { method: "POST", body: fd, credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Envoi impossible.");
    }, "Photo ajoutée");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {peutModifier && statut === "SIGNE" && (
          <Button size="lg" className="h-auto min-h-16 text-base" disabled={pending} onClick={() => action(() => api(`/api/ordres-reparation/${ordreId}/demarrer`, "POST"), "Travaux démarrés")}>
            <Play aria-hidden />
            Démarrer les travaux
          </Button>
        )}
        {peutModifier && (
          <>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="sr-only" aria-label="Ajouter une photo" onChange={(e) => envoyerPhoto(e.target.files?.[0])} />
            <Button size="lg" variant="outline" className="h-auto min-h-16 text-base" disabled={pending} onClick={() => fileRef.current?.click()}>
              <Camera aria-hidden />
              Ajouter une photo
            </Button>
          </>
        )}
      </div>

      {statut === "EN_ATTENTE_SIGNATURE" && peutModifier && (
        <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning-bg p-4 text-warning">
          <span className="text-sm font-medium">En attente de la signature du client avant de démarrer les travaux.</span>
          <Button onClick={() => setSignOuvert(true)}>
            <PenLine aria-hidden />
            Faire signer
          </Button>
        </div>
      )}
      {signature && <p className="text-sm text-success">Ordre signé par le client.</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Tâches</h2>
        {taches.length === 0 && <p className="text-sm text-muted-foreground">Aucune tâche sur cet ordre.</p>}
        {taches.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!peutModifier || pending || termine}
            onClick={() => action(() => api(`/api/ordres-reparation/${ordreId}/taches/${t.id}`, "PATCH", { terminee: !t.terminee }))}
            className="mb-2 flex w-full items-center gap-3.5 rounded-xl border bg-card p-4 text-left text-base transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-card"
            aria-pressed={t.terminee}
          >
            {t.terminee ? <CheckCircle2 className="size-6 text-success" aria-hidden /> : <Circle className="size-6 text-muted-foreground" aria-hidden />}
            <span className={t.terminee ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{t.designation}</span>
            {t.dureeHeures > 0 && <span className="text-sm text-muted-foreground">{t.dureeHeures} h</span>}
          </button>
        ))}
      </div>

      {photos.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Photos ({photos.length})</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p) => (
              <a key={p.id} href={`/api/fichiers/${p.url}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/fichiers/${p.url}`} alt="Photo de l'ordre de réparation" className="aspect-square w-full rounded-lg border object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}

      {peutModifier && (statut === "SIGNE" || statut === "EN_COURS") && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={pending || !ficheValidee} onClick={() => setFinOuverte(true)}>
            <CheckCircle2 aria-hidden />
            Terminer l&apos;ordre
          </Button>
          {!ficheValidee && <span className="text-sm text-muted-foreground">Validez d&apos;abord la fiche de contrôle ci-dessous.</span>}
        </div>
      )}

      <Dialog open={finOuverte} onOpenChange={(o) => !pending && setFinOuverte(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminer l&apos;ordre de réparation</DialogTitle>
            <DialogDescription>L&apos;ordre passe « À traiter par le Magasin » et la facture est préparée en brouillon.</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              terminer();
            }}
          >
            <Field label="Kilométrage au compteur" htmlFor="or-km" hint="Mention obligatoire sur la facture ; met aussi à jour la fiche du véhicule.">
              <Input id="or-km" inputMode="numeric" autoFocus value={km} onChange={(e) => setKm(e.target.value)} />
            </Field>
            {erreurFin && (
              <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-destructive">
                {erreurFin}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setFinOuverte(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                Terminer et transmettre
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={signOuvert} onOpenChange={setSignOuvert}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Signature du client</DialogTitle>
            <DialogDescription>Le client signe pour autoriser les travaux décrits dans le devis.</DialogDescription>
          </DialogHeader>
          <SignaturePad
            pending={pending}
            onSave={(image) =>
              action(async () => {
                await api(`/api/ordres-reparation/${ordreId}/signature`, "POST", { image });
                setSignOuvert(false);
              }, "Signature enregistrée")
            }
          />
          {pending && <Loader2 className="mx-auto animate-spin" aria-hidden />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
