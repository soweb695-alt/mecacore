import type { Metadata } from "next";
import Link from "next/link";
import { OrdresTable } from "@/components/or/columns";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_ORDRE } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ordres de réparation" };

export default async function OrdresPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "ordre");
  const sp = await searchParams;
  const mecano = user.role === "MECANICIEN";
  // Onglet du Magasin : OR terminés par l'atelier, à facturer (brouillon prêt) ou à compléter par un devis.
  const magasin = !mecano && sp.vue === "magasin";
  const termines = sp.vue === "termines";
  const where: Prisma.OrdreReparationWhereInput = {
    ...(mecano ? { userId: user.id } : {}),
    statut: magasin
      ? "A_TRAITER_MAGASIN"
      : termines
        ? { in: mecano ? ["A_TRAITER_MAGASIN", "FACTURE"] : ["FACTURE"] }
        : { in: ["EN_ATTENTE_SIGNATURE", "SIGNE", "EN_COURS"] },
  };
  const aTraiter = mecano ? 0 : await db.ordreReparation.count({ where: { statut: "A_TRAITER_MAGASIN" } });
  const ordres = await db.ordreReparation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { firstName: true } },
      fiche: { select: { statut: true } },
      devis: {
        select: {
          clientId: true,
          vehiculeId: true,
          facture: { select: { id: true, statut: true, numero: true } },
          client: { select: { type: true, firstName: true, lastName: true, companyName: true } },
          vehicule: { select: { marque: true, modele: true, immatriculation: true } },
        },
      },
    },
  });

  const onglets = (
    <div className="mb-4 flex gap-2">
      {[
        { href: "/ordres-reparation", label: mecano ? "Mes OR" : "En cours", actif: !termines && !magasin },
        ...(mecano ? [] : [{ href: "/ordres-reparation?vue=magasin", label: `À traiter par le Magasin${aTraiter ? ` (${aTraiter})` : ""}`, actif: magasin }]),
        { href: "/ordres-reparation?vue=termines", label: mecano ? "Terminés" : "Facturés", actif: termines },
      ].map((o) => (
        <Link key={o.href} href={o.href} className={cn("rounded-full px-4 py-1.5 text-sm font-medium", o.actif ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
          {o.label}
        </Link>
      ))}
    </div>
  );

  if (mecano) {
    return (
      <>
        <PageHeader title="Mes ordres de réparation" description="Touchez un ordre pour démarrer les travaux, cocher les tâches et ajouter des photos." />
        {onglets}
        <div className="grid gap-3 md:grid-cols-2">
          {ordres.length === 0 && <p className="text-muted-foreground">Aucun ordre pour le moment.</p>}
          {ordres.map((o) => (
            <Link key={o.id} href={`/ordres-reparation/${o.id}`} className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{o.numero}</span>
                <StatusBadge tone={TONE_ORDRE[o.statut]}>{LABELS.statutOrdre[o.statut]}</StatusBadge>
              </div>
              <div className="text-lg font-semibold">
                {o.devis.vehicule ? `${o.devis.vehicule.marque} ${o.devis.vehicule.modele}` : "Véhicule"}
              </div>
              <div className="text-sm text-muted-foreground">
                {o.devis.vehicule?.immatriculation} · {nomClient(o.devis.client)}
              </div>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ordres de réparation" description="Créés automatiquement à la validation d'un devis mécanique." />
      {onglets}
      <Card className="p-2">
        <OrdresTable
          magasin={magasin}
          rows={ordres.map((o) => ({
            id: o.id,
            numero: o.numero,
            vehicule: o.devis.vehicule ? `${o.devis.vehicule.marque} ${o.devis.vehicule.modele} · ${o.devis.vehicule.immatriculation}` : null,
            client: nomClient(o.devis.client),
            technicien: o.user?.firstName ?? null,
            statut: o.statut,
            fiche: o.fiche ? (o.fiche.statut === "TRANSMISE" || o.fiche.statut === "TRAITEE" ? o.fiche.statut : "EN_COURS") : null,
            date: (magasin ? o.updatedAt : o.createdAt).toISOString(),
            kilometrage: o.kilometrage,
            ...(magasin
              ? {
                  actions: {
                    preparer: !o.devis.facture && can(user, "create", "facture"),
                    facture: o.devis.facture && can(user, "update", "facture") ? { id: o.devis.facture.id, libelle: o.devis.facture.statut === "BROUILLON" ? "Finaliser la facture" : `Facture ${o.devis.facture.numero}` } : null,
                    devisComplementaire: can(user, "create", "devis") ? `/devis/nouveau?clientId=${o.devis.clientId}${o.devis.vehiculeId ? `&vehiculeId=${o.devis.vehiculeId}` : ""}` : null,
                  },
                }
              : {}),
          }))}
        />
      </Card>
    </>
  );
}
