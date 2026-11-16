import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { CollaborateurForm } from "@/components/collaborateurs/collaborateur-form";
import { CollaborateursTable } from "@/components/collaborateurs/columns";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <CollaborateursTable rows={users.map((u) => ({ ...u, couleurAffichee: couleurCollaborateur(u.id, u.couleur) }))} />
      </Card>
    </>
  );
}
