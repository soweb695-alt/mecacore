import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { OrdresTable } from "@/components/or/columns";
import { LABELS, StatusBadge, TONE_RDV } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { dansJours, dateLongueFR, eur, heureFR, joursDepuis, nomClient } from "@/lib/format";
import { can, canSeeMargins } from "@/lib/permissions";
import { piecesEnAlerte } from "@/lib/services/pieces";
import { analyser } from "@/lib/services/analyse";
import { rafraichirStatuts } from "@/lib/services/factures";
import { requireUser } from "@/lib/session";
import { jourParis, parisVersUtc, ajouterJoursStr } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "MECANICIEN") redirect("/ordres-reparation");
  await rafraichirStatuts();

  const aujourdhui = jourParis();
  const [analyse, orEnCours, orAttente, impayes, alertesStock, devisEnvoyes, rdvs, ordres, fichesATraiter] = await Promise.all([
    analyser("mois"),
    db.ordreReparation.count({ where: { statut: { in: ["SIGNE", "EN_COURS"] } } }),
    db.ordreReparation.count({ where: { statut: "EN_ATTENTE_SIGNATURE" } }),
    db.facture.findMany({ where: { statut: "IMPAYEE" }, orderBy: { dateEcheance: "asc" }, include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } } } }),
    piecesEnAlerte(4),
    db.devis.findMany({ where: { statut: "ENVOYE", updatedAt: { lt: dansJours(-3) } }, orderBy: { updatedAt: "asc" }, take: 3, include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } } } }),
    db.rendezVous.findMany({
      where: { debut: { gte: parisVersUtc(`${aujourdhui}T00:00`), lt: parisVersUtc(`${ajouterJoursStr(aujourdhui, 1)}T00:00`) }, statut: { in: ["PLANIFIE", "CONFIRME"] } },
      orderBy: { debut: "asc" },
      include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } }, vehicule: { select: { marque: true, modele: true } } },
    }),
    db.ordreReparation.findMany({
      where: { statut: { in: ["EN_ATTENTE_SIGNATURE", "SIGNE", "EN_COURS"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { firstName: true } }, fiche: { select: { statut: true } }, devis: { select: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } }, vehicule: { select: { marque: true, modele: true, immatriculation: true } } } } },
    }),
    db.ordreReparation.findMany({
      where: { statut: "A_TRAITER_MAGASIN" },
      orderBy: { updatedAt: "asc" },
      take: 3,
      select: { id: true, numero: true, devis: { select: { facture: { select: { id: true, statut: true } }, vehicule: { select: { marque: true, modele: true, immatriculation: true } } } } },
    }),
  ]);
  const totalImpaye = impayes.reduce((s, f) => s + Number(f.totalTTC) - Number(f.montantPaye), 0);
  const nbAlertes = fichesATraiter.length + alertesStock.length + impayes.length + devisEnvoyes.length;
  const marges = canSeeMargins(user);

  const kpis = [
    { l: "Chiffre d'affaires du mois", v: eur(analyse.caHT), s: `${analyse.nbFactures} facture${analyse.nbFactures > 1 ? "s" : ""} HT` },
    ...(marges ? [{ l: "Marge", v: `${analyse.margePct} %`, s: eur(analyse.marge) }] : []),
    { l: "OR en cours", v: String(orEnCours), s: `dont ${orAttente} en attente de signature` },
    { l: "Factures impayées", v: eur(totalImpaye), s: `${impayes.length} facture${impayes.length > 1 ? "s" : ""} échue${impayes.length > 1 ? "s" : ""}`, danger: impayes.length > 0 },
  ];

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={dateLongueFR(dansJours(0))}
        actions={
          <>
            {can(user, "create", "client") && (
              <Link href="/clients" className={cn(buttonVariants({ variant: "outline" }))}>
                <UserPlus aria-hidden />
                Nouveau client
              </Link>
            )}
            {can(user, "create", "devis") && (
              <Link href="/devis/nouveau" className={cn(buttonVariants())}>
                <Plus aria-hidden />
                Nouveau devis
              </Link>
            )}
          </>
        }
      />
      {/* Chiffres du jour en une ligne : la taille et l'espace hiérarchisent, la couleur ne sert qu'aux impayés. */}
      <dl className="mb-6 flex flex-wrap gap-x-10 gap-y-3 border-b pb-4 text-sm">
        {kpis.map((k) => (
          <div key={k.l}>
            <dt className="text-muted-foreground">{k.l}</dt>
            <dd className={cn("text-base font-semibold tabular-nums", k.danger && "text-destructive")}>
              {k.v} <span className={cn("text-xs font-normal", k.danger ? "text-destructive" : "text-muted-foreground")}>{k.s}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>À traiter</CardTitle>
            {nbAlertes > 0 && <span className="text-sm tabular-nums text-muted-foreground">{nbAlertes}</span>}
          </CardHeader>
          <CardContent className="divide-y">
            {nbAlertes === 0 && <p className="py-3 text-sm text-muted-foreground">Rien à signaler.</p>}
            {fichesATraiter.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">Atelier</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{o.numero} à traiter par le Magasin</div>
                  <div className="text-xs text-muted-foreground">
                    {o.devis.vehicule ? `${o.devis.vehicule.marque} ${o.devis.vehicule.modele} · ${o.devis.vehicule.immatriculation}` : "Véhicule"} · terminé par l&apos;atelier
                  </div>
                </div>
                <Link href={o.devis.facture?.statut === "BROUILLON" ? `/factures/${o.devis.facture.id}` : `/ordres-reparation/${o.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  {o.devis.facture?.statut === "BROUILLON" ? "Finaliser la facture" : "Ouvrir l'OR"}
                </Link>
              </div>
            ))}
            {alertesStock.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 text-xs text-warning">Stock</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.nom}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock : {p.stock} · seuil d&apos;alerte : {p.seuilAlerte}
                  </div>
                </div>
                <Link href={`/stock/${p.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Voir le stock
                </Link>
              </div>
            ))}
            {impayes.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 text-xs text-destructive">Impayé</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {f.numero} · {nomClient(f.client)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Échue depuis {Math.max(1, joursDepuis(f.dateEcheance))} jours · {eur(Number(f.totalTTC) - Number(f.montantPaye))} restants
                  </div>
                </div>
                <Link href={`/factures/${f.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Ouvrir
                </Link>
              </div>
            ))}
            {devisEnvoyes.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">Devis</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {d.numero} · {nomClient(d.client)}
                  </div>
                  <div className="text-xs text-muted-foreground">Envoyé sans réponse depuis plus de 3 jours</div>
                </div>
                <Link href={`/devis/${d.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Relancer
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rendez-vous du jour</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {rdvs.length === 0 && <p className="py-3 text-sm text-muted-foreground">Aucun rendez-vous aujourd&apos;hui.</p>}
            {rdvs.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="w-12 text-sm font-semibold tabular-nums">{heureFR(r.debut)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.vehicule.marque} {r.vehicule.modele}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {nomClient(r.client)}
                    {r.motif ? ` · ${r.motif}` : ""}
                  </div>
                </div>
                <StatusBadge tone={TONE_RDV[r.statut]}>{LABELS.statutRdv[r.statut]}</StatusBadge>
              </div>
            ))}
            <div className="pt-3">
              <Link href="/rendez-vous" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Ouvrir le planning
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ordres de réparation en cours</CardTitle>
          <Link href="/ordres-reparation" className="text-sm text-link hover:underline">
            Tout voir
          </Link>
        </CardHeader>
        <CardContent>
          <OrdresTable
            compact
            magasin={false}
            rows={ordres.map((o) => ({
              id: o.id,
              numero: o.numero,
              vehicule: o.devis.vehicule ? `${o.devis.vehicule.marque} ${o.devis.vehicule.modele} · ${o.devis.vehicule.immatriculation}` : null,
              client: nomClient(o.devis.client),
              technicien: o.user?.firstName ?? null,
              statut: o.statut,
              fiche: o.fiche ? (o.fiche.statut === "TRANSMISE" || o.fiche.statut === "TRAITEE" ? o.fiche.statut : "EN_COURS") : null,
              date: o.createdAt.toISOString(),
              kilometrage: o.kilometrage,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
