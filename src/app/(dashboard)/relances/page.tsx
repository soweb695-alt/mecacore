import type { Metadata } from "next";
import Link from "next/link";
import { RelanceButton } from "@/components/factures/relance-button";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateFR, eur, nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { facturesARelancer } from "@/lib/services/relances";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Relances" };

export default async function RelancesPage() {
  const user = await requirePage("read", "facture");
  const factures = await facturesARelancer();
  const total = factures.reduce((s, f) => s + f.reste, 0);
  const peutRelancer = can(user, "update", "facture");

  return (
    <>
      <PageHeader
        title="Relances"
        description={`Factures impayées (échéance dépassée) : ${factures.length} · ${eur(total)} restant dû. Chaque relance est datée et comptée.`}
      />
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-right">Retard</TableHead>
              <TableHead className="text-right">Reste dû</TableHead>
              <TableHead className="text-right">Nombre de relances</TableHead>
              <TableHead>Dernière relance</TableHead>
              {peutRelancer && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {factures.length === 0 && (
              <TableRow>
                <TableCell colSpan={peutRelancer ? 8 : 7} className="py-10 text-center text-muted-foreground">
                  Aucune facture impayée. Rien à relancer.
                </TableCell>
              </TableRow>
            )}
            {factures.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">
                  <Link href={`/factures/${f.id}`} className="hover:underline">
                    {f.numero}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${f.client.id}`} className="hover:underline">
                    {nomClient(f.client)}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{[f.client.phone, f.client.email].filter(Boolean).join(" · ") || "Aucun contact"}</span>
                </TableCell>
                <TableCell>{dateFR(f.dateEcheance)}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">{f.joursRetard} j</TableCell>
                <TableCell className="text-right tabular-nums">{eur(f.reste)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{f.nombreRelances}</TableCell>
                <TableCell>{f.derniereRelance ? dateFR(f.derniereRelance) : <span className="text-muted-foreground">Jamais</span>}</TableCell>
                {peutRelancer && (
                  <TableCell className="text-right">
                    <RelanceButton factureId={f.id} numero={f.numero} />
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
