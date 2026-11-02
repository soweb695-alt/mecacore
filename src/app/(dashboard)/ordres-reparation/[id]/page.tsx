import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssignMecanicien } from "@/components/or/assign-mecanicien";
import { FicheControle } from "@/components/or/fiche-controle";
import { OrdreTablette } from "@/components/or/ordre-tablette";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_ORDRE } from "@/components/status-badge";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { obtenirFiche } from "@/lib/services/fiche-controle";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Ordre de réparation" };

export default async function OrdreDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("read", "ordre");
  const { id } = await params;
  // Sélection explicite : aucun prix ni total n'est chargé pour la vue mécanicien.
  const o = await db.ordreReparation.findUnique({
    where: { id },
    select: {
      id: true, numero: true, statut: true, userId: true, signatureUrl: true, devisId: true, kilometrage: true,
      taches: { orderBy: { position: "asc" }, select: { id: true, designation: true, dureeHeures: true, terminee: true } },
      photos: { orderBy: { createdAt: "asc" }, select: { id: true, url: true } },
      devis: {
        select: {
          numero: true,
          kilometrage: true,
          facture: { select: { id: true, statut: true, numero: true } },
          client: { select: { type: true, firstName: true, lastName: true, companyName: true } },
          vehicule: { select: { marque: true, modele: true, immatriculation: true, motorisation: true, kilometrage: true } },
        },
      },
    },
  });
  if (!o) notFound();
  if (!can(user, "read", "ordre", o.userId ?? "")) redirect("/ordres-reparation");

  const mecano = user.role === "MECANICIEN";
  const mecaniciens = mecano ? [] : await db.user.findMany({ where: { role: "MECANICIEN", isActive: true }, select: { id: true, firstName: true, lastName: true } });
  const v = o.devis.vehicule;
  const fiche = await obtenirFiche(o.id);
  const valideePar = fiche.valideeParId ? await db.user.findUnique({ where: { id: fiche.valideeParId }, select: { firstName: true } }) : null;
  const valideeLe = fiche.valideeLe
    ? `le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(fiche.valideeLe)}${valideePar ? ` par ${valideePar.firstName}` : ""}`
    : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {v ? `${v.marque} ${v.modele} · ${v.immatriculation}` : o.numero}
            <StatusBadge tone={TONE_ORDRE[o.statut]}>{LABELS.statutOrdre[o.statut]}</StatusBadge>
          </span>
        }
        description={`${o.numero} · ${nomClient(o.devis.client)}${v?.motorisation ? ` · ${v.motorisation}` : ""}${o.kilometrage != null ? ` · ${o.kilometrage.toLocaleString("fr-FR")} km` : ""}`}
        actions={
          !mecano && (
            <>
              <AssignMecanicien ordreId={o.id} valeur={o.userId} mecaniciens={mecaniciens.map((m) => ({ id: m.id, nom: `${m.firstName} ${m.lastName}` }))} />
              {o.devis.facture && can(user, "update", "facture") && (
                <Link href={`/factures/${o.devis.facture.id}`} className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  {o.devis.facture.statut === "BROUILLON" ? "Finaliser la facture" : `Facture ${o.devis.facture.numero}`}
                </Link>
              )}
              {can(user, "read", "devis") && (
                <Link href={`/devis/${o.devisId}`} className="inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-medium hover:bg-muted">
                  Voir le devis {o.devis.numero}
                </Link>
              )}
            </>
          )
        }
      />
      <div className="max-w-4xl space-y-4">
        <OrdreTablette
          ordreId={o.id}
          statut={o.statut}
          taches={o.taches.map((t) => ({ ...t, dureeHeures: Number(t.dureeHeures) }))}
          photos={o.photos}
          signature={!!o.signatureUrl}
          kilometrage={o.kilometrage ?? o.devis.vehicule?.kilometrage ?? o.devis.kilometrage}
          ficheValidee={fiche.statut !== "EN_COURS"}
          peutModifier={can(user, "update", "ordre", o.userId ?? "")}
        />
        <FicheControle
          ordreId={o.id}
          statut={fiche.statut}
          points={fiche.points.map((p) => ({ id: p.id, libelle: p.libelle, resultat: p.resultat }))}
          remarques={fiche.remarques ?? ""}
          validee={valideeLe}
          peutRemplir={user.role !== "SECRETARIAT" && can(user, "update", "ordre", o.userId ?? "")}
          peutTraiter={user.role !== "MECANICIEN"}
        />
      </div>
    </>
  );
}
