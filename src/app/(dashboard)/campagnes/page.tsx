import type { Metadata } from "next";
import { Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { CampagneForm } from "@/components/campagnes/campagne-form";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateFR } from "@/lib/format";
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
  const brevo = Boolean(process.env.BREVO_API_KEY);
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
          L&apos;envoi d&apos;e-mails n&apos;est pas encore configuré (clé Brevo manquante) : vous pouvez préparer des campagnes, mais pas les envoyer.
        </p>
      )}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campagne</TableHead>
                <TableHead>Destinataires</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Envoyés</TableHead>
                <TableHead className="w-64" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campagnes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Megaphone className="mx-auto mb-2 size-6" aria-hidden />
                    Aucune campagne. Créez votre première promotion.
                  </TableCell>
                </TableRow>
              )}
              {campagnes.map((c) => {
                const envoyee = !!c.envoyeeLe;
                const partielle = envoyee && c.nbEchecs > 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.nom}</div>
                      <div className="text-xs text-muted-foreground">{c.sujet}</div>
                    </TableCell>
                    <TableCell>{AUDIENCES[c.audience as keyof typeof AUDIENCES] ?? c.audience}</TableCell>
                    <TableCell>
                      <StatusBadge tone={partielle ? "warn" : envoyee ? "ok" : "neutral"}>{partielle ? "Envoi incomplet" : envoyee ? `Envoyée le ${dateFR(c.envoyeeLe)}` : "Brouillon"}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{envoyee ? `${c.nbEnvoyes} / ${c.nbDestinataires}` : "–"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {(!envoyee || partielle) && edition && (
                          <ConfirmButton
                            label={partielle ? "Relancer les échecs" : "Envoyer"}
                            title={partielle ? "Relancer l'envoi ?" : "Envoyer cette campagne ?"}
                            description={
                              partielle
                                ? `${c.nbEchecs} envoi(s) ont échoué : seuls ces clients seront relancés, les autres ne recevront rien de plus.`
                                : `L'e-mail « ${c.sujet} » sera envoyé à ${compteurs[c.audience as keyof typeof compteurs] ?? 0} client(s) ayant accepté de recevoir des offres. Cette action est définitive.`
                            }
                            url={`/api/campagnes/${c.id}/envoyer`}
                            method="POST"
                            success="Campagne envoyée"
                            variant="default"
                            size="sm"
                          >
                            <Send aria-hidden />
                          </ConfirmButton>
                        )}
                        {!envoyee && edition && (
                          <FormDialog
                            title="Modifier la campagne"
                            wide
                            trigger={
                              <Button variant="outline" size="sm">
                                <Pencil aria-hidden />
                                Modifier
                              </Button>
                            }
                          >
                            <CampagneForm
                              compteurs={compteurs}
                              campagne={{ id: c.id, nom: c.nom, audience: c.audience as "TOUS" | "PARTICULIER" | "PRO", sujet: c.sujet ?? "", contenu: c.contenu ?? "" }}
                            />
                          </FormDialog>
                        )}
                        {!envoyee && can(user, "delete", "campagne") && (
                          <ConfirmButton label="" title="Supprimer cette campagne ?" description="La campagne non envoyée sera supprimée définitivement." url={`/api/campagnes/${c.id}`} success="Campagne supprimée" variant="destructive" size="sm">
                            <Trash2 aria-hidden />
                          </ConfirmButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rappels automatiques de rendez-vous</CardTitle>
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
          <p className="pt-1 text-xs text-muted-foreground">Envoyés chaque jour par la tâche planifiée, à tous les clients concernés (messages de service, hors campagnes).</p>
        </CardContent>
      </Card>
    </>
  );
}
