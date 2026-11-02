import type { Metadata } from "next";
import Link from "next/link";
import { PreparerFactureButton } from "@/components/or/preparer-facture-button";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge, TONE_ORDRE } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { dateFR, nomClient } from "@/lib/format";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Véhicule</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Technicien</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Fiche de contrôle</TableHead>
              <TableHead>{magasin ? "Terminé le" : "Créé le"}</TableHead>
              <TableHead className="text-right">Kilométrage</TableHead>
              {magasin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordres.length === 0 && (
              <TableRow>
                <TableCell colSpan={magasin ? 9 : 8} className="py-10 text-center text-muted-foreground">
                  {magasin ? "Aucun ordre de réparation à traiter." : "Aucun ordre de réparation."}
                </TableCell>
              </TableRow>
            )}
            {ordres.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <Link href={`/ordres-reparation/${o.id}`} className="hover:underline">
                    {o.numero}
                  </Link>
                </TableCell>
                <TableCell>{o.devis.vehicule ? `${o.devis.vehicule.marque} ${o.devis.vehicule.modele} · ${o.devis.vehicule.immatriculation}` : "–"}</TableCell>
                <TableCell>{nomClient(o.devis.client)}</TableCell>
                <TableCell>{o.user?.firstName ?? "Non assigné"}</TableCell>
                <TableCell>
                  <StatusBadge tone={TONE_ORDRE[o.statut]}>{LABELS.statutOrdre[o.statut]}</StatusBadge>
                </TableCell>
                <TableCell>
                  {o.fiche?.statut === "TRANSMISE" ? <StatusBadge tone="warn">Transmise</StatusBadge> : o.fiche?.statut === "TRAITEE" ? <StatusBadge tone="ok">Traitée</StatusBadge> : <span className="text-muted-foreground">{o.fiche ? "En cours" : "–"}</span>}
                </TableCell>
                <TableCell>{dateFR(magasin ? o.updatedAt : o.createdAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{o.kilometrage != null ? `${o.kilometrage.toLocaleString("fr-FR")} km` : "–"}</TableCell>
                {magasin && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {!o.devis.facture && can(user, "create", "facture") && <PreparerFactureButton ordreId={o.id} />}
                      {o.devis.facture && can(user, "update", "facture") && (
                        <Link href={`/factures/${o.devis.facture.id}`} className={cn(buttonVariants({ size: "sm" }))}>
                          {o.devis.facture.statut === "BROUILLON" ? "Finaliser la facture" : `Facture ${o.devis.facture.numero}`}
                        </Link>
                      )}
                      {can(user, "create", "devis") && (
                        <Link href={`/devis/nouveau?clientId=${o.devis.clientId}${o.devis.vehiculeId ? `&vehiculeId=${o.devis.vehiculeId}` : ""}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                          Devis complémentaire
                        </Link>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
