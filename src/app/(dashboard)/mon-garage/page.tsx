import type { Metadata } from "next";
import { BanqueForm } from "@/components/parametres/banque-form";
import { GarageForm } from "@/components/parametres/garage-form";
import { LogoUpload } from "@/components/parametres/logo-upload";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Mon Garage" };

export default async function MonGaragePage() {
  await requirePage("update", "parametre");
  const g = await db.parametreGarage.findUnique({ where: { id: 1 } });
  return (
    <>
      <PageHeader title="Mon Garage" description="Informations imprimées en en-tête et en pied de page des devis, factures et bons de livraison." />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
            <CardDescription>Nom, adresse et contacts en en-tête ; SIRET et TVA en pied de page.</CardDescription>
          </CardHeader>
          <CardContent>
            <GarageForm
              initial={{ nomGarage: g?.nomGarage ?? "", adresse: g?.adresse ?? "", telephone: g?.telephone ?? "", email: g?.email ?? "", siret: g?.siret ?? "", tvaNumber: g?.tvaNumber ?? "" }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>Affiché à gauche de l&apos;en-tête des PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUpload version={g?.logoMaj?.toISOString() ?? g?.logoUrl ?? null} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées bancaires</CardTitle>
            <CardDescription>Imprimées sur les factures réglées par virement.</CardDescription>
          </CardHeader>
          <CardContent>
            <BanqueForm iban={g?.iban ?? ""} bic={g?.bic ?? ""} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
