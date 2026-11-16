import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { TopPiecesTable } from "@/components/analyse/columns";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eur } from "@/lib/format";
import { analyser, type Periode } from "@/lib/services/analyse";
import { requirePage } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analyse" };

const PERIODES: { id: Periode; label: string }[] = [
  { id: "mois", label: "Ce mois-ci" },
  { id: "trimestre", label: "Trimestre" },
  { id: "annee", label: "Année" },
];

export default async function AnalysePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("read", "analyse");
  const sp = await searchParams;
  const periode: Periode = sp.periode === "trimestre" || sp.periode === "annee" ? sp.periode : "mois";
  const a = await analyser(periode);
  const max = Math.max(1, ...a.mois.map((m) => m.ca));
  const maxCollab = Math.max(1, ...a.parCollaborateur.map((c) => c.ca));

  return (
    <>
      <PageHeader
        title="Analyse"
        description={a.libelle}
        actions={
          <>
            <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Période">
              {PERIODES.map((p) => (
                <Link key={p.id} href={`/analyse?periode=${p.id}`} aria-current={p.id === periode ? "true" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm", p.id === periode ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>
                  {p.label}
                </Link>
              ))}
            </div>
            <a href={`/api/analyse/export?type=factures&periode=${periode}`} className={cn(buttonVariants({ variant: "outline" }))}>
              <Download aria-hidden />
              Exporter en CSV
            </a>
          </>
        }
      />
      {/* Chiffres de la période en une ligne : lus d'un coup d'œil, sans cartes. */}
      <dl className="mb-6 flex flex-wrap gap-x-10 gap-y-3 border-b pb-4 text-sm">
        {[
          { l: "CA HT", v: eur(a.caHT), s: `${a.nbFactures} facture${a.nbFactures > 1 ? "s" : ""}` },
          { l: "Marge brute", v: eur(a.marge), s: `${a.margePct} % du CA` },
          { l: "Devis validés", v: `${a.tauxValidation} %`, s: `${a.devisValides} sur ${a.devisTotal}` },
          { l: "Panier moyen", v: eur(a.panierMoyen), s: "par facture" },
        ].map((k) => (
          <div key={k.l}>
            <dt className="text-muted-foreground">{k.l}</dt>
            <dd className="text-base font-semibold tabular-nums">
              {k.v} <span className="text-xs font-normal text-muted-foreground">{k.s}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CA HT des 6 derniers mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-3" role="img" aria-label={`CA mensuel : ${a.mois.map((m) => `${m.label} ${eur(m.ca)}`).join(", ")}`}>
              {a.mois.map((m) => (
                <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">{m.ca > 0 ? Math.round(m.ca) : ""}</span>
                  <div className="w-full max-w-11 rounded-t-md bg-primary" style={{ height: `${(m.ca / max) * 78}%`, minHeight: m.ca > 0 ? 4 : 0 }} />
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>CA par collaborateur</CardTitle>
            <a href={`/api/analyse/export?type=collaborateurs&periode=${periode}`} className="text-xs text-link hover:underline">
              CSV
            </a>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.parCollaborateur.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture sur la période.</p>}
            {a.parCollaborateur.map((c) => (
              <div key={c.nom}>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-[2px]" style={{ background: c.couleur }} aria-hidden />
                    {c.nom}
                  </span>
                  <b className="tabular-nums">{eur(c.ca)}</b>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full" style={{ width: `${(c.ca / maxCollab) * 100}%`, background: c.couleur }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Top pièces vendues</CardTitle>
          <a href={`/api/analyse/export?type=pieces&periode=${periode}`} className="text-xs text-link hover:underline">
            CSV
          </a>
        </CardHeader>
        <CardContent>
          <TopPiecesTable rows={a.topPieces.map((p) => ({ id: p.id, nom: p.nom, reference: p.reference, qte: p.qte, ca: p.ca, marge: p.marge }))} />
        </CardContent>
      </Card>
    </>
  );
}
