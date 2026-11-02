"use client";

import { Loader2, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

/** OR à traiter sans brouillon : prépare la facture depuis le devis puis l'ouvre. */
export function PreparerFactureButton({ ordreId }: { ordreId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const f = await api<{ id: string }>(`/api/ordres-reparation/${ordreId}/facture`, "POST");
          router.push(`/factures/${f.id}`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Receipt aria-hidden />}
      Préparer la facture
    </Button>
  );
}
