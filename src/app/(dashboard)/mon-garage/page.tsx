import type { Metadata } from "next";
import { BanqueForm } from "@/components/parametres/banque-form";
import { BrevoConnexion } from "@/components/parametres/brevo-connexion";
import { GarageForm } from "@/components/parametres/garage-form";
import { HorairesForm } from "@/components/parametres/horaires-form";
import { ModelesEmailForm } from "@/components/parametres/modeles-email-form";
import { LogoUpload } from "@/components/parametres/logo-upload";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { manquesBrevo } from "@/lib/integrations/brevo";
import { requirePage } from "@/lib/session";
import { lireHoraires } from "@/lib/validators/parametres";

export const metadata: Metadata = { title: "Mon Garage" };

export default async function MonGaragePage() {
  await requirePage("update", "parametre");
  const g = await db.parametreGarage.findUnique({ where: { id: 1 } });
  return (
    <>
      <PageHeader title="Mon Garage" description="Coordonnées et mentions légales des PDF, horaires d'ouverture, modèles des e-mails envoyés aux clients, logo et IBAN." />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées et mentions légales</CardTitle>
            <CardDescription>Nom, adresse et contacts en en-tête des PDF ; SIRET, TVA, forme juridique, capital et RCS en pied de page.</CardDescription>
          </CardHeader>
          <CardContent>
            <GarageForm
              initial={{ nomGarage: g?.nomGarage ?? "", adresse: g?.adresse ?? "", telephone: g?.telephone ?? "", email: g?.email ?? "", siret: g?.siret ?? "", tvaNumber: g?.tvaNumber ?? "", formeJuridique: g?.formeJuridique ?? "", capitalSocial: g?.capitalSocial ?? "", rcs: g?.rcs ?? "" }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Horaires d&apos;ouverture</CardTitle>
            <CardDescription>Repris dans les e-mails envoyés aux clients (véhicule prêt, rappel de rendez-vous).</CardDescription>
          </CardHeader>
          <CardContent>
            <HorairesForm initial={lireHoraires(g?.horaires)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Modèles d&apos;e-mails</CardTitle>
            <CardDescription>Textes envoyés par les boutons « Véhicule prêt » (ordre de réparation, devis) et « Rappel RDV » (planning), et par les rappels automatiques.</CardDescription>
          </CardHeader>
          <CardContent>
            <ModelesEmailForm
              initial={{
                vehiculePret: { sujet: g?.emailVehiculePretSujet ?? "", corps: g?.emailVehiculePretCorps ?? "" },
                rappelRdv: { sujet: g?.emailRappelRdvSujet ?? "", corps: g?.emailRappelRdvCorps ?? "" },
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Envoi des e-mails (Brevo)</CardTitle>
            <CardDescription>Devis, bons de livraison, véhicule prêt, rappels et campagnes partent par Brevo. La clé se règle chez l&apos;hébergeur, pas ici.</CardDescription>
          </CardHeader>
          <CardContent>
            <BrevoConnexion manques={manquesBrevo()} expediteur={process.env.BREVO_SENDER_EMAIL?.trim() || null} emailGarage={g?.email ?? ""} />
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
