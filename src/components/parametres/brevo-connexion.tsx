"use client";

import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

interface Etat {
  manques: string[];
  expediteur: string | null;
  compte: { ok: true; compte: string; entreprise: string | null } | { ok: false; erreur: string } | null;
}

/** Connexion Brevo : vérification de la clé (sans envoi) puis e-mail de test réel. */
export function BrevoConnexion({ manques, expediteur, emailGarage }: { manques: string[]; expediteur: string | null; emailGarage: string }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [destinataire, setDestinataire] = useState(emailGarage);
  const [pending, setPending] = useState<"verif" | "test" | null>(null);

  async function verifier() {
    setPending("verif");
    try {
      setEtat(await api<Etat>("/api/integrations/email", "GET"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vérification impossible.");
    } finally {
      setPending(null);
    }
  }

  async function tester(e: React.FormEvent) {
    e.preventDefault();
    setPending("test");
    try {
      await api("/api/integrations/email", "POST", { destinataire });
      toast.success(`E-mail de test envoyé à ${destinataire} : vérifiez la boîte de réception (et les indésirables).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-4 text-sm">
      {manques.length > 0 ? (
        <p role="status" className="rounded-lg bg-warning-bg px-3 py-2 text-warning">
          Non configuré : {manques.join(" et ")} {manques.length > 1 ? "manquent" : "manque"} dans les variables d&apos;environnement de l&apos;hébergeur. Les e-mails sont simulés (notés dans l&apos;historique, jamais envoyés).
        </p>
      ) : (
        <p>
          Expéditeur : <b>{expediteur}</b>. Les réponses des clients arrivent sur <b>{emailGarage || "l'e-mail du garage (à renseigner ci-dessus)"}</b>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={verifier} disabled={pending !== null}>
          {pending === "verif" ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          Vérifier la connexion
        </Button>
        {etat?.compte && (
          <span role="status" className={etat.compte.ok ? "text-success" : "text-destructive"}>
            {etat.compte.ok ? `Clé acceptée par Brevo (compte ${etat.compte.compte}${etat.compte.entreprise ? `, ${etat.compte.entreprise}` : ""}).` : etat.compte.erreur}
          </span>
        )}
      </div>

      <form onSubmit={tester} className="flex flex-wrap items-end gap-2">
        <Field label="Envoyer un e-mail de test à" htmlFor="brevo-test" className="w-80">
          <Input id="brevo-test" type="email" value={destinataire} onChange={(e) => setDestinataire(e.target.value)} placeholder="vous@garage.fr" />
        </Field>
        <Button type="submit" disabled={pending !== null || !destinataire || manques.length > 0}>
          {pending === "test" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          Envoyer le test
        </Button>
      </form>
    </div>
  );
}
