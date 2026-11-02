"use client";

import { BellRing, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function RelanceButton({ factureId, numero }: { factureId: string; numero: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      aria-label={`Marquer ${numero} comme relancée`}
      onClick={async () => {
        setPending(true);
        try {
          const r = await api<{ nombreRelances: number }>(`/api/factures/${factureId}/relances`, "POST");
          toast.success(`${numero} : relance n° ${r.nombreRelances} enregistrée`);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />}
      Marquer comme relancé
    </Button>
  );
}
