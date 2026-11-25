"use client";

import { BellRing, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";

export interface RappelVue {
  rdvId: string;
  campagneId: string;
  joursAvant: number;
  canal: "EMAIL" | "SMS";
  quand: string;
  client: string;
  vehicule: string;
  destinataire: string | null;
}

interface Resultat {
  rdvId: string;
  resultat: "envoye" | "simulation" | "deja" | "refuse" | "echec" | "erreur";
  message?: string;
}

/**
 * Rappels de rendez-vous du jour (J-1, J-7…), à valider : rien ne part sans un clic « Envoyer »
 * suivi d'une confirmation. Un rappel envoyé disparaît de la liste.
 */
export function RappelsAEnvoyer({ rappels }: { rappels: RappelVue[] }) {
  const router = useRouter();
  const [confirmer, setConfirmer] = useState<RappelVue[] | null>(null);
  const [pending, setPending] = useState(false);
  const envoyables = rappels.filter((r) => r.destinataire);

  async function envoyer(liste: RappelVue[]) {
    setPending(true);
    try {
      const { resultats } = await api<{ resultats: Resultat[] }>("/api/rappels-rdv", "POST", { rappels: liste.map((r) => ({ rdvId: r.rdvId, campagneId: r.campagneId })) });
      const ok = resultats.filter((r) => r.resultat === "envoye").length;
      const simul = resultats.filter((r) => r.resultat === "simulation").length;
      const ko = resultats.filter((r) => !["envoye", "simulation", "deja"].includes(r.resultat));
      if (ok) toast.success(`${ok} rappel${ok > 1 ? "s" : ""} envoyé${ok > 1 ? "s" : ""}`);
      if (simul) toast.warning(`${simul} rappel${simul > 1 ? "s" : ""} non envoyé${simul > 1 ? "s" : ""} : l'envoi d'e-mails n'est pas configuré (Brevo).`);
      if (ko.length) toast.error(ko[0].message ?? `${ko.length} rappel${ko.length > 1 ? "s" : ""} non envoyé${ko.length > 1 ? "s" : ""}`);
      setConfirmer(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {rappels.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Aucun rappel de rendez-vous à envoyer aujourd&apos;hui.</p>
      ) : (
        <ul className="divide-y">
          {rappels.map((r) => (
            <li key={`${r.rdvId}-${r.campagneId}`} className="flex items-center gap-3 py-2.5">
              <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {r.client} · RDV {r.quand}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.vehicule} · rappel J-{r.joursAvant} par {r.canal === "SMS" ? "SMS" : "e-mail"}
                  {r.destinataire ? ` à ${r.destinataire}` : " : pas de coordonnée, impossible à envoyer"}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={pending || !r.destinataire} onClick={() => setConfirmer([r])}>
                <Send aria-hidden />
                Envoyer
              </Button>
            </li>
          ))}
        </ul>
      )}
      {envoyables.length > 1 && (
        <div className="pt-1">
          <Button size="sm" disabled={pending} onClick={() => setConfirmer(envoyables)}>
            <Send aria-hidden />
            Tout envoyer ({envoyables.length})
          </Button>
        </div>
      )}

      <Dialog open={confirmer !== null} onOpenChange={(o) => !o && setConfirmer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmer && confirmer.length > 1 ? `Envoyer ${confirmer.length} rappels ?` : "Envoyer ce rappel ?"}</DialogTitle>
            <DialogDescription>Le rappel de rendez-vous (modèle de Paramètres › Communication) sera envoyé à :</DialogDescription>
          </DialogHeader>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {confirmer?.map((r) => (
              <li key={`${r.rdvId}-${r.campagneId}`}>
                <b>{r.client}</b> · {r.destinataire}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmer(null)}>
              Annuler
            </Button>
            <Button disabled={pending} onClick={() => confirmer && envoyer(confirmer)}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
