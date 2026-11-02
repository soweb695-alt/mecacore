import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download, Plus, Upload } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { LienTelechargement } from "@/components/telechargement";
import { ImportPieces } from "@/components/stock/import-pieces";
import { PieceForm } from "@/components/stock/piece-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { eur } from "@/lib/format";
import { can, canSeeMargins, canSeePurchasePrice } from "@/lib/permissions";
import { rechercherPieces } from "@/lib/services/pieces";
import { requirePage } from "@/lib/session";
import { pieceListQuery } from "@/lib/validators/piece";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "piece");
  const sp = await searchParams;
  const parsed = pieceListQuery.safeParse({ q: sp.q || undefined, categorie: sp.categorie || undefined, bas: sp.bas || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const [res, cats] = await Promise.all([
    rechercherPieces(user, { q: query.q, categorie: query.categorie, bas: query.bas === "1", page: query.page }),
    db.piece.findMany({ where: { isActive: true, categorie: { not: null } }, distinct: ["categorie"], select: { categorie: true }, orderBy: { categorie: "asc" } }),
  ]);
  const marges = canSeeMargins(user);
  const achat = canSeePurchasePrice(user);
  const filtresExport = [sp.q && `&q=${encodeURIComponent(sp.q)}`, sp.categorie && `&categorie=${encodeURIComponent(sp.categorie)}`, sp.bas && "&bas=1"].filter(Boolean).join("");
  const nbCol = 5 + (achat ? 1 : 0) + (marges ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Stock"
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
              <PieceForm voirAchat={achat} />
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead>Fournisseur</TableHead>
              {achat && <TableHead className="text-right">Prix achat HT</TableHead>}
              <TableHead className="text-right">Prix vente HT</TableHead>
              {marges && <TableHead className="text-right">Marge</TableHead>}
              <TableHead>Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {res.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={nbCol} className="py-10 text-center text-muted-foreground">
                  Aucune pièce ne correspond à votre recherche.
                </TableCell>
              </TableRow>
            )}
            {res.items.map((p) => (
              <TableRow key={p.id} className={p.enAlerte ? "bg-warning-bg/40" : undefined}>
                <TableCell className="font-medium">
                  <Link href={`/stock/${p.id}`} className="hover:underline">
                    {p.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  {p.nom}
                  {p.referenceCroisee && <div className="text-xs font-medium text-link">Équivalent de {p.referenceCroisee}</div>}
                  {p.referencesCroisees.length > 0 && <div className="text-xs text-muted-foreground">Croisées : {p.referencesCroisees.join(", ")}</div>}
                </TableCell>
                <TableCell>{p.fournisseur ?? "–"}</TableCell>
                {achat && <TableCell className="text-right tabular-nums">{p.prixAchatHT !== undefined ? eur(p.prixAchatHT) : "–"}</TableCell>}
                <TableCell className="text-right tabular-nums">{eur(p.prixVenteHT)}</TableCell>
                {marges && <TableCell className="text-right tabular-nums">{p.margePct !== undefined ? `${p.margePct} %` : "–"}</TableCell>}
                <TableCell>
                  {p.enAlerte ? (
                    <StatusBadge tone="warn">
                      <AlertTriangle className="size-3" aria-hidden />
                      {p.stock} / seuil {p.seuilAlerte}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="ok">{p.stock}</StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={query.page} pages={res.pages} basePath="/stock" params={{ q: sp.q, categorie: sp.categorie, bas: sp.bas }} />
    </>
  );
}
