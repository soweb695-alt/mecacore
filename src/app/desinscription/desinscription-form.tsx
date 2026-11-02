"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DesinscriptionForm({ c, s }: { c: string; s: string }) {
  const [etat, setEtat] = useState<"attente" | "envoi" | "fait" | "erreur">("attente");
  if (etat === "fait") return <p role="status" className="text-sm font-medium text-success">C&apos;est fait : vous êtes désinscrit des offres.</p>;
  return (
    <div className="space-y-3">
      <Button
        disabled={etat === "envoi"}
        onClick={async () => {
          setEtat("envoi");
          const res = await fetch("/api/public/desinscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c, s }) }).catch(() => null);
          setEtat(res?.ok ? "fait" : "erreur");
        }}
      >
        Confirmer la désinscription
      </Button>
      {etat === "erreur" && (
        <p role="alert" className="text-sm text-destructive">
          La désinscription a échoué. Réessayez ou contactez le garage.
        </p>
      )}
    </div>
  );
}
