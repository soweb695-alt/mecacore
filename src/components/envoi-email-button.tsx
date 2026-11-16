"use client";

import { Mail } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";

/** Envoi d'un e-mail au client après confirmation (destinataire affiché) : « Véhicule prêt », « Rappel RDV ». */
export function EnvoiEmailButton({ label, url, client, email, sujet, size = "default" }: { label: string; url: string; client: string; email: string | null; sujet: string; size?: "sm" | "default" }) {
  return (
    <ConfirmButton
      label={label}
      title={`Envoyer « ${sujet} » ?`}
      description={email ? `${client} recevra l'e-mail à ${email}. L'envoi est noté dans l'historique du client.` : `${client} n'a pas d'adresse e-mail : ajoutez-la sur sa fiche avant l'envoi.`}
      url={url}
      method="POST"
      success={`E-mail envoyé à ${email ?? client}`}
      variant="outline"
      size={size}
    >
      <Mail aria-hidden />
    </ConfirmButton>
  );
}
