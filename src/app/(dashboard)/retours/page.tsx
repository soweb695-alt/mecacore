import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { RetourForm } from "@/components/retours/retour-form";
import { LABELS, StatusBadge, TONE_RETOUR } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateFR, eur, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { filtreRetours } from "@/lib/services/retours";
import { requirePage } from "@/lib/session";
import { jourParis } from "@/lib/time";
import { retourListQuery } from "@/lib/validators/retour";

export const metadata: Metadata = { title: "Retours & Consignées" };
const TAILLE = 25;

export default async function RetoursPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "retour");
  const sp = await searchParams;
  const parsed = retourListQuery.safeParse({ q: sp.q || undefined, type: sp.type || undefined, statut: sp.statut || undefined, clientId: sp.clientId || undefined, ordreId: sp.ordreId || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const where = filtreRetours(query);
  const ouverts = { statut: { in: ["EN_ATTENTE", "RENVOYEE_FOURNISSEUR"] as ("EN_ATTENTE" | "RENVOYEE_FOURNISSEUR")[] } };
  const [total, items, enAttente, consignes] = await Promise.all([
    db.retourPiece.count({ where }),
    db.retourPiece.findMany({
      where,
      orderBy: { dateEntree: "desc" },
      skip: (query.page - 1) * TAILLE,
      take: TAILLE,
      include: {
        client: { select: { id: true, type: true, firstName: true, lastName: true, companyName: true } },
        ordre: { select: { id: true, numero: true } },
        piece: { select: { id: true, reference: true, nom: true } },
      },
    }),
    db.retourPiece.count({ where: { statut: "EN_ATTENTE" } }),
    db.retourPiece.findMany({ where: { type: "CONSIGNE", ...ouverts }, select: { montantConsigneHT: true, quantite: true } }),
  ]);
  const aRecuperer = consignes.reduce((s, c) => s + Number(c.montantConsigneHT ?? 0) * c.quantite, 0);
  const peutCreer = can(user, "create", "retour");
  const peutModifier = can(user, "update", "retour");
  const peutSupprimer = can(user, "delete", "retour");
  const aujourdhui = jourParis();

  return (
    <>
      <PageHeader
        title="Retours & Consignées"
        description="Anciennes pièces déposées et pièces consignées (échange standard), rattachées à un client et/ou à un ordre de réparation."
        actions={
          peutCreer && (
            <FormDialog
              title="Nouveau retour ou consigne"
              wide
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nouveau retour
                </Button>
              }
            >
              <RetourForm aujourdhui={aujourdhui} />
            </FormDialog>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">En attente de traitement</div>
          <div className="text-2xl font-semibold tabular-nums">{enAttente}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Consignes à récupérer (HT)</div>
          <div className="text-2xl font-semibold tabular-nums">{eur(Math.round(aRecuperer * 100) / 100)}</div>
        </Card>
      </div>
      <form method="get" className="mb-4 flex flex-wrap gap-2.5">
        <Input name="q" defaultValue={sp.q} placeholder="N°, pièce, référence, client, OR…" aria-label="Rechercher un retour" className="w-80" maxLength={100} />
        <NativeSelect name="type" defaultValue={sp.type ?? ""} aria-label="Type" className="w-56">
          <option value="">Tous les types</option>
          {Object.entries(LABELS.typeRetour).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="statut" defaultValue={sp.statut ?? ""} aria-label="Statut" className="w-52">
          <option value="">Tous les statuts</option>
          {Object.entries(LABELS.statutRetour).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        {sp.clientId && <input type="hidden" name="clientId" value={sp.clientId} />}
        {sp.ordreId && <input type="hidden" name="ordreId" value={sp.ordreId} />}
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Pièce</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead>Client / OR</TableHead>
              <TableHead>Entrée</TableHead>
              <TableHead className="text-right">Consigne HT</TableHead>
              <TableHead>Statut</TableHead>
              {(peutModifier || peutSupprimer) && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Aucun retour ni pièce consignée.
                </TableCell>
              </TableRow>
            )}
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.numero}</TableCell>
                <TableCell className="text-xs">{LABELS.typeRetour[r.type]}</TableCell>
                <TableCell>
                  <span className="font-medium">{r.designation}</span>
                  {(r.reference || r.fournisseur) && (
                    <span className="block text-xs text-muted-foreground">{[r.reference && `Réf. ${r.reference}`, r.fournisseur].filter(Boolean).join(" · ")}</span>
                  )}
                  {r.notes && <span className="block max-w-xs truncate text-xs text-muted-foreground" title={r.notes}>{r.notes}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.quantite}</TableCell>
                <TableCell>
                  {r.client ? (
                    <Link href={`/clients/${r.client.id}`} className="hover:underline">
                      {nomClient(r.client)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                  {r.ordre && (
                    <Link href={`/ordres-reparation/${r.ordre.id}`} className="block text-xs text-muted-foreground hover:underline">
                      {r.ordre.numero}
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  {dateFR(r.dateEntree)}
                  {r.dateTraitement && <span className="block text-xs text-muted-foreground">traité le {dateFR(r.dateTraitement)}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.montantConsigneHT !== null ? eur(r.montantConsigneHT.toString()) : "–"}</TableCell>
                <TableCell>
                  <StatusBadge tone={TONE_RETOUR[r.statut]}>{LABELS.statutRetour[r.statut]}</StatusBadge>
                </TableCell>
                {(peutModifier || peutSupprimer) && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {peutModifier && (
                        <FormDialog
                          title={`Modifier ${r.numero}`}
                          wide
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${r.numero}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        >
                          <RetourForm
                            aujourdhui={aujourdhui}
                            retour={{
                              id: r.id,
                              type: r.type,
                              statut: r.statut,
                              designation: r.designation,
                              reference: r.reference ?? "",
                              quantite: r.quantite,
                              montantConsigneHT: r.montantConsigneHT !== null ? Number(r.montantConsigneHT) : null,
                              fournisseur: r.fournisseur ?? "",
                              notes: r.notes ?? "",
                              dateEntree: r.dateEntree.toISOString().slice(0, 10),
                              client: r.client ? { id: r.client.id, nom: nomClient(r.client) } : null,
                              ordre: r.ordre,
                              piece: r.piece ? { id: r.piece.id, libelle: `${r.piece.nom} (${r.piece.reference})` } : null,
                            }}
                          />
                        </FormDialog>
                      )}
                      {peutSupprimer && (
                        <ConfirmButton
                          label=""
                          title={`Supprimer ${r.numero} ?`}
                          description="Le retour est définitivement supprimé. Pour un retour traité, préférez le statut « Clôturée »."
                          url={`/api/retours/${r.id}`}
                          success="Retour supprimé"
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 aria-hidden />
                        </ConfirmButton>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={query.page} pages={Math.max(1, Math.ceil(total / TAILLE))} basePath="/retours" params={{ q: sp.q, type: sp.type, statut: sp.statut, clientId: sp.clientId, ordreId: sp.ordreId }} />
    </>
  );
}
