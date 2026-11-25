import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { CampagnesTable } from "@/components/campagnes/columns";
import { CampagneForm } from "@/components/campagnes/campagne-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { configBrevo } from "@/lib/integrations/brevo";
import { can } from "@/lib/permissions";
import { compterDestinataires } from "@/lib/services/campagnes";
import { requirePage } from "@/lib/session";
import { AUDIENCES } from "@/lib/validators/campagne";

export const metadata: Metadata = { title: "Campagnes" };

export default async function CampagnesPage() {
  const user = await requirePage("read", "campagne");
  const [campagnes, automatiques, compteurs] = await Promise.all([
    db.campagne.findMany({ where: { type: "MANUELLE" }, orderBy: { createdAt: "desc" } }),
    db.campagne.findMany({ where: { type: "AUTOMATIQUE" }, orderBy: { joursAvant: "desc" } }),
    compterDestinataires(),
  ]);
  const params = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { expediteurEmail: true } });
  const brevo = configBrevo(params?.expediteurEmail) !== null;
  const edition = can(user, "update", "campagne");

  return (
    <>
      <PageHeader
        title="Campagnes"
        description="E-mails promotionnels envoyés aux clients ayant donné leur accord (opt-in). Chaque e-mail contient un lien de désinscription."
        actions={
          can(user, "create", "campagne") && (
            <FormDialog
              title="Nouvelle campagne"
              wide
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nouvelle campagne
                </Button>
              }
            >
              <CampagneForm compteurs={compteurs} />
            </FormDialog>
          )
        }
      />
      {!brevo && (
        <p role="note" className="mb-4 rounded-lg bg-warning-bg px-4 py-3 text-sm text-warning">
          L&apos;envoi d&apos;e-mails n&apos;est pas encore configuré (Brevo, voir Mon Garage) : vous pouvez préparer des campagnes, mais pas les envoyer.
        </p>
      )}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <CampagnesTable
            edition={edition}
            suppression={can(user, "delete", "campagne")}
            compteurs={compteurs}
            rows={campagnes.map((c) => ({
              id: c.id,
              nom: c.nom,
              sujet: c.sujet ?? "",
              contenu: c.contenu ?? "",
              audience: c.audience as "TOUS" | "PARTICULIER" | "PRO",
              audienceLibelle: AUDIENCES[c.audience as keyof typeof AUDIENCES] ?? c.audience,
              envoyeeLe: c.envoyeeLe ? c.envoyeeLe.toISOString() : null,
              nbEnvoyes: c.nbEnvoyes,
              nbDestinataires: c.nbDestinataires,
              nbEchecs: c.nbEchecs,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rappels de rendez-vous</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {automatiques.map((a) => (
            <div key={a.id} className="flex items-center justify-between">
              <span>
                {a.nom} · {a.canal === "SMS" ? "SMS" : "E-mail"}
              </span>
              <StatusBadge tone={a.actif ? "ok" : "neutral"}>{a.actif ? "Actif" : "Désactivé"}</StatusBadge>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">Proposés chaque jour sur le tableau de bord (« Rappels de rendez-vous à envoyer ») : rien ne part sans votre validation.</p>
        </CardContent>
      </Card>
    </>
  );
}
