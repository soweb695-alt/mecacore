import type { Metadata } from "next";
import { PointsControleEditor } from "@/components/parametres/points-controle-editor";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  await requirePage("update", "parametre");
  const points = await db.pointControle.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  return (
    <>
      <PageHeader title="Paramètres" description="Modèle de la fiche de contrôle. Les coordonnées du garage, le logo et l'IBAN sont dans « Mon Garage »." />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Points de la fiche de contrôle</CardTitle>
            <CardDescription>Chaque ordre de réparation reçoit une copie de cette liste. Les fiches déjà créées ne sont pas modifiées.</CardDescription>
          </CardHeader>
          <CardContent>
            <PointsControleEditor points={points.map((p) => ({ id: p.id, libelle: p.libelle, isActive: p.isActive }))} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
