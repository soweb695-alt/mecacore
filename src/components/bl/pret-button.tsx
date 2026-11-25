"use client";

import { Mail, PackageCheck, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";

interface ResultatEmail {
  resultat: "envoye" | "sans_email" | "non_configure" | "echec";
  destinataire: string | null;
}

/** Message affiché après l'envoi du BL : succès ou raison de l'échec. */
function annonceEmail(e: ResultatEmail | undefined) {
  if (e?.resultat === "envoye") toast.success(`Bon de livraison envoyé à ${e.destinataire}`);
  else if (e?.resultat === "sans_email") toast.warning("Le bon n'a pas été envoyé : le client n'a pas d'adresse e-mail.");
  else if (e?.resultat === "non_configure") toast.warning("Le bon n'a pas été envoyé : l'envoi d'e-mails n'est pas configuré (Brevo).");
  else toast.warning("L'e-mail du bon de livraison n'a pas pu partir. Réessayez dans un instant.");
}

/** Envoi du bon de livraison au client, toujours à la main et après confirmation (aucun envoi automatique). */
export function BlRenvoyerButton({ id, numero, client, email }: { id: string; numero: string; client: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen(true)}>
        <Mail aria-hidden />
        Envoyer le BL
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer {numero} par e-mail ?</DialogTitle>
            <DialogDescription>
              {email ? <>Le bon de livraison (PDF sans prix) sera envoyé à {client} ({email}).</> : <>{client} n&apos;a pas d&apos;adresse e-mail : ajoutez-la sur sa fiche.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={pending || !email}
              onClick={async () => {
                setPending(true);
                try {
                  annonceEmail(await api<ResultatEmail>(`/api/bons-livraison/${id}/envoyer`, "POST"));
                  setOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
                } finally {
                  setPending(false);
                }
              }}
            >
              <Mail aria-hidden />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Fait avancer un bon de livraison : En attente → Prêt à être retiré → Livré. */
export function BlStatutButton({ id, action }: { id: string; action: "prete" | "livre" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const livre = action === "livre";
  return (
    <Button
      size="sm"
      variant={livre ? "default" : "outline"}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api(`/api/bons-livraison/${id}/${action}`, "POST");
          // Aucun e-mail automatique : le BL s'envoie ensuite avec « Envoyer le BL ».
          toast.success(livre ? "Commande livrée. Pour envoyer le bon au client : « Envoyer le BL »." : "Commande prête à être retirée");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      {livre ? <Truck aria-hidden /> : <PackageCheck aria-hidden />}
      {livre ? "Marquer livré" : "Prêt à être retiré"}
    </Button>
  );
}
