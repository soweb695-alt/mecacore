import type { Metadata } from "next";
import { Pencil, UserPlus } from "lucide-react";
import { CollaborateurForm } from "@/components/collaborateurs/collaborateur-form";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { LABELS, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { couleurCollaborateur } from "@/lib/colors";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Collaborateurs" };

export default async function CollaborateursPage() {
  await requirePage("read", "collaborateur");
  const users = await db.user.findMany({ orderBy: [{ isActive: "desc" }, { firstName: "asc" }], select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, couleur: true } });
  return (
    <>
      <PageHeader
        title="Collaborateurs"
        description="Comptes d'accès et rôles. Seul l'administrateur voit cette page."
        actions={
          <FormDialog title="Nouveau collaborateur" trigger={<Button><UserPlus aria-hidden />Nouveau collaborateur</Button>}>
            <CollaborateurForm />
          </FormDialog>
        }
      />
      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Collaborateur</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <span className="mr-2 inline-block size-2.5 rounded-[2px]" style={{ background: couleurCollaborateur(u.id, u.couleur) }} aria-hidden />
                  {u.firstName} {u.lastName}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{LABELS.role[u.role]}</TableCell>
                <TableCell>
                  <StatusBadge tone={u.isActive ? "ok" : "neutral"}>{u.isActive ? "Actif" : "Désactivé"}</StatusBadge>
                </TableCell>
                <TableCell>
                  <FormDialog title="Modifier le collaborateur" trigger={<Button variant="ghost" size="icon-sm" aria-label={`Modifier ${u.firstName} ${u.lastName}`}><Pencil aria-hidden /></Button>}>
                    <CollaborateurForm user={u} />
                  </FormDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
