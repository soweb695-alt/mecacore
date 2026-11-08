import type { Metadata } from "next";
import { DevisEditor } from "@/components/devis/devis-editor";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { dansJours, nomClient } from "@/lib/format";
import { canSeeMargins, canSeePurchasePrice } from "@/lib/permissions";
import { tarifsActifs } from "@/lib/services/tarifs";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Nouveau devis" };

export default async function NouveauDevis({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("create", "devis");
  const sp = await searchParams;
  const vehicule = sp.vehiculeId ? await db.vehicule.findUnique({ where: { id: sp.vehiculeId } }) : null;
  const [tarifs, client] = await Promise.all([
    tarifsActifs(),
    (sp.clientId ?? vehicule?.clientId) ? db.client.findFirst({ where: { id: (sp.clientId ?? vehicule?.clientId)!, isActive: true, anonymiseLe: null } }) : null,
  ]);
  const valid = dansJours(30).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Nouveau devis" description="Le numéro est attribué à l'enregistrement." />
      <DevisEditor
        voirMarges={canSeeMargins(user)}
        voirAchat={canSeePurchasePrice(user)}
        tarifs={tarifs}
        initial={{
          type: "MECANIQUE",
          client: client ? { id: client.id, type: client.type, nom: nomClient(client), discountRate: Number(client.discountRate) } : null,
          vehicule: vehicule
            ? { id: vehicule.id, clientId: vehicule.clientId, immatriculation: vehicule.immatriculation, marque: vehicule.marque, modele: vehicule.modele, vin: vehicule.vin, kilometrage: vehicule.kilometrage, prochainCT: vehicule.prochainCT ? vehicule.prochainCT.toISOString().slice(0, 10) : null }
            : null,
          kilometrage: vehicule?.kilometrage ?? null,
          prochainCT: vehicule?.prochainCT ? vehicule.prochainCT.toISOString().slice(0, 10) : "",
          dateValidite: valid,
          lignes: [],
        }}
      />
    </>
  );
}
