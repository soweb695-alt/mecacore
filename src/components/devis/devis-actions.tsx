"use client";

import { Check, FileDown, Lock, Mail, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Field } from "@/components/forms/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/client-api";
import { cn } from "@/lib/utils";

interface Penurie {
  reference: string;
  nom: string;
  demande: number;
  disponible: number;
}

export function DevisActions({
  id,
  statut,
  type,
  mecaniciens,
  droits,
  jourParDefaut,
  clientEmail,
}: {
  id: string;
  statut: "BROUILLON" | "ENVOYE" | "VALIDE" | "REJETE";
  type: "MECANIQUE" | "PIECE";
  mecaniciens: { id: string; nom: string }[];
  droits: { valider: boolean; rouvrir: boolean; modifier: boolean };
  jourParDefaut: string;
  clientEmail: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"valider" | "rejeter" | null>(null);
  const [mecanicienId, setMecanicienId] = useState(mecaniciens[0]?.id ?? "");
  const [jour, setJour] = useState(jourParDefaut);
  const [debut, setDebut] = useState("09:00");
  const [fin, setFin] = useState("10:00");
  const [motif, setMotif] = useState("");
  const [pending, setPending] = useState(false);
  const [penuries, setPenuries] = useState<Penurie[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const mecanique = type === "MECANIQUE";
  const enAttente = statut === "ENVOYE" || statut === "BROUILLON";

  async function envoyerParEmail() {
    if (!clientEmail) {
      toast.error("Ce client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche.");
      return;
    }
    setPending(true);
    try {
      await api(`/api/devis/${id}/envoyer`, "POST");
      toast.success(`Devis envoyé à ${clientEmail}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function valider() {
    setErreur(null);
    if (mecanique) {
      if (!mecanicienId) return setErreur("Choisissez le technicien.");
      if (!jour || !debut || !fin || fin <= debut) return setErreur("Indiquez un créneau valide (la fin doit être après le début).");
    }
    setPending(true);
    setPenuries(null);
    try {
      const body = mecanique ? { mecanicienId, rdv: { debut: `${jour}T${debut}`, fin: `${jour}T${fin}` } } : {};
      const r = await api<{ ordre: { numero: string } | null; bonLivraison: { numero: string } | null; reappro: unknown[] }>(`/api/devis/${id}/valider`, "POST", body);
      toast.success(
        r.ordre ? `Devis validé · ${r.ordre.numero} créé et rendez-vous planifié` : r.bonLivraison ? `Devis validé · ${r.bonLivraison.numero} en attente de livraison` : "Devis validé",
      );
      if (r.reappro?.length) toast.info("Bon de commande automatique créé pour les pièces au seuil d'alerte.");
      setDialog(null);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "STOCK_INSUFFISANT") setPenuries((e.details as Penurie[] | undefined) ?? []);
      else setErreur(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function rejeter() {
    if (motif.trim().length < 3) {
      setErreur("Le motif est obligatoire.");
      return;
    }
    setPending(true);
    try {
      await api(`/api/devis/${id}/rejeter`, "POST", { motif });
      toast.success("Devis rejeté");
      setDialog(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <a href={`/api/devis/${id}/pdf`} target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }))}>
        <FileDown aria-hidden />
        PDF
      </a>
      {enAttente && droits.modifier && (
        <Button variant="outline" onClick={envoyerParEmail} disabled={pending}>
          <Mail aria-hidden />
          Envoyer par e-mail
        </Button>
      )}
      {enAttente && droits.valider && (
        <>
          <Button variant="outline" onClick={() => { setErreur(null); setDialog("rejeter"); }}>
            <X aria-hidden />
            Rejeter
          </Button>
          <Button onClick={() => { setPenuries(null); setErreur(null); setDialog("valider"); }}>
            <Check aria-hidden />
            Valider le devis
          </Button>
        </>
      )}
      {statut !== "ENVOYE" && statut !== "BROUILLON" && droits.rouvrir && (
        <ConfirmButton
          label="Rouvrir"
          variant="outline"
          size="default"
          method="POST"
          url={`/api/devis/${id}/rouvrir`}
          title="Rouvrir ce devis ?"
          description="Le devis repasse à « Envoyé » (ou reste tel quel s'il n'a jamais été envoyé). Si l'ordre de réparation n'est pas encore signé, il est supprimé avec son rendez-vous et le stock est restitué."
          success="Devis rouvert"
        >
          <Undo2 aria-hidden />
        </ConfirmButton>
      )}
      {statut === "VALIDE" && <Lock className="size-4 text-muted-foreground" aria-label="Devis verrouillé" />}

      <Dialog open={dialog === "valider"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Valider ce devis</DialogTitle>
            <DialogDescription>
              {mecanique
                ? "Le stock est décrémenté, l'ordre de réparation créé et le rendez-vous placé sur le planning du technicien, en une seule opération."
                : "Le stock est décrémenté et un bon de livraison « en attente » est créé. Aucun ordre de réparation n'est créé pour une vente de pièces."}
            </DialogDescription>
          </DialogHeader>
          {mecanique && (
            <div className="space-y-3">
              <Field label="Technicien" htmlFor="technicien">
                <NativeSelect id="technicien" value={mecanicienId} onChange={(e) => setMecanicienId(e.target.value)}>
                  {mecaniciens.length === 0 && <option value="">Aucun technicien actif</option>}
                  {mecaniciens.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Jour du rendez-vous" htmlFor="rdv-jour">
                  <Input id="rdv-jour" type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
                </Field>
                <Field label="Début" htmlFor="rdv-debut">
                  <Input id="rdv-debut" type="time" step={900} value={debut} onChange={(e) => setDebut(e.target.value)} />
                </Field>
                <Field label="Fin" htmlFor="rdv-fin">
                  <Input id="rdv-fin" type="time" step={900} value={fin} onChange={(e) => setFin(e.target.value)} />
                </Field>
              </div>
            </div>
          )}
          {penuries && penuries.length > 0 && (
            <div role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-destructive">
              <p className="font-medium">Stock insuffisant, rien n&apos;a été modifié :</p>
              <ul className="mt-1 list-disc pl-5">
                {penuries.map((p) => (
                  <li key={p.reference}>
                    {p.nom} ({p.reference}) : {p.demande} demandé, {p.disponible} disponible
                  </li>
                ))}
              </ul>
            </div>
          )}
          {erreur && (
            <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-destructive">
              {erreur}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Annuler
            </Button>
            <Button onClick={valider} disabled={pending}>
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "rejeter"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter ce devis</DialogTitle>
            <DialogDescription>Indiquez le motif du rejet (obligatoire).</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea aria-label="Motif du rejet" value={motif} maxLength={500} onChange={(e) => { setMotif(e.target.value); setErreur(null); }} placeholder="Prix trop élevé, véhicule vendu…" />
            {erreur && <p role="alert" className="text-xs text-destructive">{erreur}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={rejeter} disabled={pending}>
              Rejeter le devis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function LienDocument({ href, libelle }: { href: string; libelle: string }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "outline" }))}>
      {libelle}
    </Link>
  );
}
