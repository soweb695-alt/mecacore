import type { Metadata } from "next";
import { RelancesTable } from "@/components/factures/relances-columns";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { eur, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { facturesARelancer } from "@/lib/services/relances";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Relances" };

export default async function RelancesPage() {
  const user = await requirePage("read", "facture");
  const factures = await facturesARelancer();
  const total = factures.reduce((s, f) => s + f.reste, 0);
  const peutRelancer = can(user, "update", "facture");

  return (
    <>
      <PageHeader
        title="Relances"
        description={`Factures impayées (échéance dépassée) : ${factures.length} · ${eur(total)} restant dû. Chaque relance est datée et comptée.`}
      />
      <Card className="p-2">
        <RelancesTable
          peutRelancer={peutRelancer}
          rows={factures.map((f) => ({
            id: f.id,
            numero: f.numero,
            client: { id: f.client.id, nom: nomClient(f.client), contact: [f.client.phone, f.client.email].filter(Boolean).join(" · ") || "Aucun contact" },
            echeance: new Date(f.dateEcheance).toISOString(),
            joursRetard: f.joursRetard,
            reste: f.reste,
            nombreRelances: f.nombreRelances,
            derniereRelance: f.derniereRelance ? new Date(f.derniereRelance).toISOString() : null,
          }))}
        />
      </Card>
    </>
  );
}
