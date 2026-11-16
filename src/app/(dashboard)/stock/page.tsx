import type { Metadata } from "next";
import { Download, Plus, Upload } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { LienTelechargement } from "@/components/telechargement";
import { ImportPieces } from "@/components/stock/import-pieces";
import { PieceForm } from "@/components/stock/piece-form";
import { StockTable } from "@/components/stock/stock-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { can, canSeeMargins, canSeePurchasePrice } from "@/lib/permissions";
import { rechercherPieces } from "@/lib/services/pieces";
import { requirePage } from "@/lib/session";
import { lireTri } from "@/lib/tri";
import { pieceListQuery } from "@/lib/validators/piece";

export const metadata: Metadata = { title: "Stocks" };

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "piece");
  const sp = await searchParams;
  const parsed = pieceListQuery.safeParse({ q: sp.q || undefined, categorie: sp.categorie || undefined, bas: sp.bas || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const tri = lireTri<Prisma.PieceOrderByWithRelationInput[] | undefined>(
    sp,
    {
      reference: (o) => [{ reference: o }],
      nom: (o) => [{ nom: o }],
      fournisseur: (o) => [{ fournisseur: o }, { nom: "asc" }],
      // Le prix d'achat n'est triable que par ceux qui le voient.
      ...(canSeePurchasePrice(user) ? { prixAchatHT: (o: "asc" | "desc") => [{ prixAchatHT: o }] } : {}),
      prixVenteHT: (o) => [{ prixVenteHT: o }],
      stock: (o) => [{ stock: o }, { nom: "asc" }],
    },
    undefined,
  );
  const [res, cats] = await Promise.all([
    rechercherPieces(user, { q: query.q, categorie: query.categorie, bas: query.bas === "1", page: query.page, orderBy: tri.orderBy }),
    db.piece.findMany({ where: { isActive: true, categorie: { not: null } }, distinct: ["categorie"], select: { categorie: true }, orderBy: { categorie: "asc" } }),
  ]);
  const marges = canSeeMargins(user);
  const achat = canSeePurchasePrice(user);
  const filtresExport = [sp.q && `&q=${encodeURIComponent(sp.q)}`, sp.categorie && `&categorie=${encodeURIComponent(sp.categorie)}`, sp.bas && "&bas=1"].filter(Boolean).join("");

  return (
    <>
      <PageHeader
        title="Stocks"
        description={
          <>
            {res.total} référence{res.total > 1 ? "s" : ""} ·{" "}
            <span className={res.alertes ? "font-semibold text-warning" : ""}>{res.alertes} sous le seuil d&apos;alerte</span>
          </>
        }
        actions={
          <>
            {can(user, "export", "piece") && (
              <>
                <LienTelechargement href={`/api/stock/export?format=xlsx${filtresExport}`}>
                  <Download aria-hidden />
                  Exporter (Excel)
                </LienTelechargement>
                <LienTelechargement href={`/api/stock/export?format=csv${filtresExport}`}>CSV</LienTelechargement>
              </>
            )}
            {can(user, "create", "piece") && (
              <FormDialog
                title="Importer des pièces"
                description="Création et mise à jour en masse depuis un fichier Excel ou CSV."
                wide
                trigger={
                  <Button variant="outline">
                    <Upload aria-hidden />
                    Importer
                  </Button>
                }
              >
                <ImportPieces avecAchat={achat} />
              </FormDialog>
            )}
            {can(user, "create", "piece") && (
            <FormDialog
              title="Nouvelle pièce"
              wide
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nouvelle pièce
                </Button>
              }
            >
              <PieceForm voirAchat={achat} voirMarge={marges} />
            </FormDialog>
            )}
          </>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input name="q" defaultValue={sp.q} placeholder="Référence, nom, référence croisée, pneu…" aria-label="Rechercher une pièce" className="w-80" maxLength={100} />
        <select name="categorie" defaultValue={sp.categorie ?? ""} aria-label="Catégorie" className="h-9 w-48 rounded-lg border border-input bg-card px-2.5 text-sm">
          <option value="">Toutes catégories</option>
          {cats.map((c) => (
            <option key={c.categorie} value={c.categorie ?? ""}>
              {c.categorie}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="bas" value="1" defaultChecked={query.bas === "1"} className="size-4 accent-[var(--primary)]" />
          Sous le seuil uniquement
        </label>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
      <Card className="p-2">
        <StockTable
          achat={achat}
          marges={marges}
          serveur={{ page: query.page, pages: res.pages, total: res.total, tri: tri.tri, ordre: tri.ordre }}
          rows={res.items.map((p) => ({
            id: p.id,
            reference: p.reference,
            nom: p.nom,
            imageMaj: p.imageMaj ? p.imageMaj.toISOString() : null,
            referenceCroisee: p.referenceCroisee ?? null,
            referencesCroisees: p.referencesCroisees,
            fournisseur: p.fournisseur,
            ...(achat && p.prixAchatHT !== undefined ? { prixAchatHT: p.prixAchatHT } : {}),
            prixVenteHT: p.prixVenteHT,
            ...(marges && p.margePct !== undefined ? { margePct: p.margePct } : {}),
            stock: p.stock,
            seuilAlerte: p.seuilAlerte,
            enAlerte: p.enAlerte,
          }))}
        />
      </Card>
    </>
  );
}
