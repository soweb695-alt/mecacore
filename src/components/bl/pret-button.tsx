"use client";

import { Mail, PackageCheck, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

interface ResultatEmail {
  resultat: "envoye" | "sans_email" | "non_configure" | "echec";
  destinataire: string | null;
}

/** Message affiché après l'envoi du BL : succès, ou avertissement (la livraison, elle, est toujours enregistrée). */
function annonceEmail(e: ResultatEmail | undefined, debut: string) {
  if (e?.resultat === "envoye") toast.success(`${debut} · bon de livraison envoyé à ${e.destinataire}`);
  else if (e?.resultat === "sans_email") toast.warning(`${debut}. Le bon n'a pas été envoyé : le client n'a pas d'adresse e-mail.`);
  else if (e?.resultat === "non_configure") toast.warning(`${debut}. Le bon n'a pas été envoyé : l'envoi d'e-mails n'est pas configuré (Brevo).`);
  else toast.warning(`${debut}. L'e-mail du bon de livraison n'a pas pu partir : utilisez « Renvoyer le BL ».`);
}

/** Renvoie le bon de livraison par e-mail au client. */
export function BlRenvoyerButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          annonceEmail(await api<ResultatEmail>(`/api/bons-livraison/${id}/envoyer`, "POST"), "BL");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Mail aria-hidden />
      Renvoyer le BL
    </Button>
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
          const r = await api<{ email?: ResultatEmail }>(`/api/bons-livraison/${id}/${action}`, "POST");
          if (!livre) toast.success("Commande prête à être retirée");
          else annonceEmail(r.email, "Commande livrée");
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
