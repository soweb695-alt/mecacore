import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { RetoursTable } from "@/components/retours/columns";
import { RetourForm } from "@/components/retours/retour-form";
import { LABELS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { eur, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { filtreRetours } from "@/lib/services/retours";
import { requirePage } from "@/lib/session";
import { jourParis } from "@/lib/time";
import { lireTri } from "@/lib/tri";
import { retourListQuery } from "@/lib/validators/retour";

export const metadata: Metadata = { title: "Retours et consignes" };
const TAILLE = 25;

export default async function RetoursPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "retour");
  const sp = await searchParams;
  const parsed = retourListQuery.safeParse({ q: sp.q || undefined, type: sp.type || undefined, statut: sp.statut || undefined, clientId: sp.clientId || undefined, ordreId: sp.ordreId || undefined, page: sp.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const where = filtreRetours(query);
  const ouverts = { statut: { in: ["EN_ATTENTE", "RENVOYEE_FOURNISSEUR"] as ("EN_ATTENTE" | "RENVOYEE_FOURNISSEUR")[] } };
  const tri = lireTri<Prisma.RetourPieceOrderByWithRelationInput[]>(
    sp,
    {
      numero: (o) => [{ numero: o }],
      type: (o) => [{ type: o }, { dateEntree: "desc" }],
      designation: (o) => [{ designation: o }],
      dateEntree: (o) => [{ dateEntree: o }],
      consigneHT: (o) => [{ montantConsigneHT: { sort: o, nulls: "last" } }],
      statut: (o) => [{ statut: o }, { dateEntree: "desc" }],
    },
    [{ dateEntree: "desc" }],
  );
  const [total, items, enAttente, consignes] = await Promise.all([
    db.retourPiece.count({ where }),
    db.retourPiece.findMany({
      where,
      orderBy: tri.orderBy,
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
        title="Retours et consignes"
        description={`${enAttente} en attente de traitement · ${eur(Math.round(aRecuperer * 100) / 100)} HT de consignes à récupérer auprès des fournisseurs`}
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
        <RetoursTable
          peutModifier={peutModifier}
          peutSupprimer={peutSupprimer}
          aujourdhui={aujourdhui}
          serveur={{ page: query.page, pages: Math.max(1, Math.ceil(total / TAILLE)), total, tri: tri.tri, ordre: tri.ordre }}
          rows={items.map((r) => ({
            id: r.id,
            numero: r.numero,
            type: r.type,
            designation: r.designation,
            detail: [r.reference && `Réf. ${r.reference}`, r.fournisseur].filter(Boolean).join(" · ") || null,
            notes: r.notes,
            quantite: r.quantite,
            client: r.client ? { id: r.client.id, nom: nomClient(r.client) } : null,
            ordre: r.ordre,
            dateEntree: r.dateEntree.toISOString(),
            dateTraitement: r.dateTraitement ? r.dateTraitement.toISOString() : null,
            consigneHT: r.montantConsigneHT !== null ? Number(r.montantConsigneHT) : null,
            statut: r.statut,
            formulaire: {
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
            },
          }))}
        />
      </Card>
    </>
  );
}
