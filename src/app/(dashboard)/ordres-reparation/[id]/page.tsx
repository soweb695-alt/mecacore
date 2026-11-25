import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AssignMecanicien } from "@/components/or/assign-mecanicien";
import { FicheControle } from "@/components/or/fiche-controle";
import { OrdreTablette } from "@/components/or/ordre-tablette";
import { EnvoiEmailButton } from "@/components/envoi-email-button";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_ORDRE } from "@/components/status-badge";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { lireDommages } from "@/lib/fiche-controle";
import { obtenirFiche, signaturesFiche } from "@/lib/services/fiche-controle";
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
          client: { select: { type: true, firstName: true, lastName: true, companyName: true, email: true } },
          vehicule: { select: { marque: true, modele: true, immatriculation: true, motorisation: true, kilometrage: true } },
        },
      },
    },
  });
  if (!o) notFound();
  if (!can(user, "read", "ordre", o.userId ?? "")) redirect("/ordres-reparation");

  const mecano = user.role === "MECANICIEN";
  const retours = can(user, "read", "retour") ? await db.retourPiece.count({ where: { ordreId: o.id } }) : null;
  const mecaniciens = mecano ? [] : await db.user.findMany({ where: { role: "MECANICIEN", isActive: true }, select: { id: true, firstName: true, lastName: true } });
  const v = o.devis.vehicule;
  const fiche = await obtenirFiche(o.id);
  const valideePar = fiche.valideeParId ? await db.user.findUnique({ where: { id: fiche.valideeParId }, select: { firstName: true } }) : null;
  const signatures = await signaturesFiche(fiche.id);
  const dateFiche = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short" }).format(d);
  const kmFiche = o.kilometrage ?? o.devis.kilometrage ?? v?.kilometrage ?? null;
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
          mecano ? (
            <a href={`/api/ordres-reparation/${o.id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium hover:bg-muted">
              <FileDown className="size-4" aria-hidden />
              PDF de l&apos;OR
            </a>
          ) : (
            <>
              <a href={`/api/ordres-reparation/${o.id}/pdf?prix=1`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium hover:bg-muted">
                <FileDown className="size-4" aria-hidden />
                PDF avec prix
              </a>
              <a href={`/api/ordres-reparation/${o.id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-medium hover:bg-muted">
                <FileDown className="size-4" aria-hidden />
                PDF sans prix
              </a>
              {(o.statut === "A_TRAITER_MAGASIN" || o.statut === "FACTURE") && can(user, "create", "message") && (
                <EnvoiEmailButton label="Véhicule prêt" sujet="Véhicule prêt" url={`/api/ordres-reparation/${o.id}/vehicule-pret`} client={nomClient(o.devis.client)} email={o.devis.client.email} />
              )}
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
              {retours !== null && (
                <Link href={`/retours?ordreId=${o.id}`} className="inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-medium hover:bg-muted">
                  Retours et consignes ({retours})
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
          version={fiche.version}
          statut={fiche.statut}
          entete={{
            date: dateFiche(fiche.valideeLe ?? fiche.createdAt),
            immatriculation: v?.immatriculation ?? "",
            marque: v ? `${v.marque} ${v.modele}` : "",
            kilometrage: kmFiche != null ? `${kmFiche.toLocaleString("fr-FR")} km` : "",
          }}
          points={fiche.points.map((p) => ({ id: p.id, libelle: p.libelle, resultat: p.resultat, categorie: p.categorie, categoriePosition: p.categoriePosition, typeStatuts: p.typeStatuts }))}
          remarques={fiche.remarques ?? ""}
          dommages={lireDommages(fiche.dommages)}
          examinant={{
            // Le technicien qui remplit la fiche est proposé comme examinant.
            nom: fiche.examinantNom ?? (mecano ? user.lastName : ""),
            prenom: fiche.examinantPrenom ?? (mecano ? user.firstName : ""),
            signe: fiche.statut !== "EN_COURS" && !!signatures?.examinantSignature,
          }}
          responsable={{ nom: fiche.responsableNom ?? "", le: fiche.verifieeLe ? dateFiche(fiche.verifieeLe) : null, signe: !!signatures?.responsableSignature }}
          validee={valideeLe}
          peutRemplir={user.role !== "SECRETARIAT" && can(user, "update", "ordre", o.userId ?? "")}
          peutTraiter={user.role !== "MECANICIEN"}
          nomUtilisateur={`${user.firstName} ${user.lastName}`}
        />
      </div>
    </>
  );
}
