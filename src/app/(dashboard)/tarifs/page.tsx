import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { PageHeader } from "@/components/page-header";
import { TarifForm } from "@/components/stock/tarif-form";
import { TarifsTable } from "@/components/stock/tarifs-columns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { tarifsActifs } from "@/lib/services/tarifs";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Tarifs" };

export default async function TarifsPage() {
  const user = await requirePage("read", "tarif");
  const tarifs = await tarifsActifs();
  const admin = can(user, "update", "tarif");

  return (
    <>
      <PageHeader
        title="Tarifs"
        description="Forfaits, main d'œuvre et frais divers proposés dans les devis."
        actions={
          admin && (
            <FormDialog
              title="Nouveau tarif"
              trigger={
                <Button>
                  <Plus aria-hidden />
                  Nouveau tarif
                </Button>
              }
            >
              <TarifForm />
            </FormDialog>
          )
        }
      />
      <Card className="p-2">
        <TarifsTable admin={admin} rows={tarifs.map((t, rang) => ({ ...t, rang }))} />
      </Card>
    </>
  );
}
