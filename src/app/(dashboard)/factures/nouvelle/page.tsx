import type { Metadata } from "next";
import { FactureForm } from "@/components/factures/facture-form";
import { PageHeader } from "@/components/page-header";
import { dansJours } from "@/lib/format";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default async function NouvelleFacture() {
  await requirePage("create", "facture");
  return (
    <>
      <PageHeader title="Nouvelle facture" description="Facture saisie directement, sans devis ni bon de livraison. Les pièces du stock sont décrémentées à l'émission." />
      <FactureForm echeanceParDefaut={dansJours(30).toISOString().slice(0, 10)} />
    </>
  );
}
