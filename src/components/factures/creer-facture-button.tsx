"use client";

import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FacturerDialog } from "@/components/factures/facturer-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import type { Totaux } from "@/lib/money";

export function CreerFactureButton({ devisId, totaux }: { devisId: string; totaux: Totaux }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Button onClick={() => setOuvert(true)}>
        <Receipt aria-hidden />
        Créer la facture
      </Button>
      <FacturerDialog
        ouvert={ouvert}
        onClose={() => setOuvert(false)}
        totaux={totaux}
        description="Vous pouvez appliquer une remise globale et indiquer le mode de règlement avant l'émission."
        onConfirm={async (options) => {
          const r = await api<{ id: string; numero: string }>("/api/factures", "POST", { devisId, ...options });
          toast.success(`Facture ${r.numero} émise`);
          router.push(`/factures/${r.id}`);
        }}
      />
    </>
  );
}
