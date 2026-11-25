import type { Metadata } from "next";
import Link from "next/link";
import { CategoriesEditor } from "@/components/parametres/categories-editor";
import { CommunicationForm } from "@/components/parametres/communication-form";
import { FacturationForm } from "@/components/parametres/facturation-form";
import { CategoriesControleEditor } from "@/components/parametres/categories-controle-editor";
import { SectionParametres } from "@/components/parametres/section";
import { SeuilForm } from "@/components/parametres/seuil-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { modele } from "@/lib/messages/modeles-email";
import { requirePage } from "@/lib/session";
import { cn } from "@/lib/utils";
import { MENTION_ACCORD_OR_DEFAUT, MENTIONS_FACTURE_DEFAUT } from "@/lib/validators/parametres";

export const metadata: Metadata = { title: "Paramètres" };

const ONGLETS = [
  { cle: "facturation", libelle: "Facturation" },
  { cle: "communication", libelle: "Communication" },
  { cle: "stocks", libelle: "Stocks & alertes" },
  { cle: "fiche", libelle: "Fiche de contrôle" },
] as const;
type Onglet = (typeof ONGLETS)[number]["cle"];

export default async function ParametresPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("update", "parametre");
  const sp = await searchParams;
  const onglet: Onglet = ONGLETS.some((o) => o.cle === sp.onglet) ? (sp.onglet as Onglet) : "facturation";
  const g = await db.parametreGarage.findUnique({ where: { id: 1 } });

  return (
    <>
      <PageHeader title="Paramètres" description="Facturation, e-mails, stocks et fiche de contrôle. Les coordonnées du garage, le logo et l'IBAN sont dans « Mon Garage »." />
      {/* Onglets internes : liens (l'onglet reste ouvert après un enregistrement ou un rafraîchissement). */}
      <nav aria-label="Sections des paramètres" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {ONGLETS.map((o) => (
          <Link
            key={o.cle}
            href={`/parametres?onglet=${o.cle}`}
            aria-current={onglet === o.cle ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              onglet === o.cle ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {o.libelle}
          </Link>
        ))}
      </nav>

      {onglet === "facturation" && (
        <FacturationForm
          initial={{
            modesPaiement: g?.modesPaiement ?? ["CB", "ESPECES", "CHEQUE", "VIREMENT", "PLUSIEURS_FOIS"],
            delaiPaiementDefaut: g?.delaiPaiementDefaut ?? 30,
            prefixDevis: g?.prefixDevis ?? "DEV",
            prefixFacture: g?.prefixFacture ?? "FAC",
            prefixBonLivraison: g?.prefixBonLivraison ?? "BL",
            mentionsFacture: g?.mentionsFacture?.trim() || MENTIONS_FACTURE_DEFAUT,
            mentionAccordOR: g?.mentionAccordOR?.trim() || MENTION_ACCORD_OR_DEFAUT,
            affichageRemise: g?.affichageRemise ?? "LIGNE",
          }}
        />
      )}

      {onglet === "communication" && (
        <CommunicationForm
          expediteurHebergeur={process.env.BREVO_SENDER_EMAIL?.trim() || null}
          initial={{
            expediteurNom: g?.expediteurNom ?? "",
            expediteurEmail: g?.expediteurEmail ?? "",
            // Texte effectif (personnalisé ou par défaut) : on modifie le vrai message.
            vehiculePret: modele("vehiculePret", { sujet: g?.emailVehiculePretSujet, corps: g?.emailVehiculePretCorps }),
            rappelRdv: modele("rappelRdv", { sujet: g?.emailRappelRdvSujet, corps: g?.emailRappelRdvCorps }),
          }}
        />
      )}

      {onglet === "stocks" && <OngletStocks seuil={g?.seuilAlerteDefaut ?? 5} />}

      {onglet === "fiche" && <OngletFiche />}
    </>
  );
}

async function OngletStocks({ seuil }: { seuil: number }) {
  const [categories, comptes] = await Promise.all([
    db.categoriePiece.findMany({ orderBy: [{ position: "asc" }, { libelle: "asc" }] }),
    db.piece.groupBy({ by: ["categorie"], where: { isActive: true, categorie: { not: null } }, _count: { _all: true } }),
  ]);
  const parCategorie = new Map(comptes.map((c) => [c.categorie, c._count._all]));
  return (
    <div>
      <SectionParametres titre="Seuil d'alerte par défaut" description="Proposé pour chaque nouvelle pièce (fiche pièce, « Nouvelle pièce » du devis, import). Le seuil reste modifiable pièce par pièce.">
        <SeuilForm initial={seuil} />
      </SectionParametres>
      <SectionParametres titre="Catégories de pièces" description="Proposées dans la fiche pièce et le filtre du Stock. Renommer une catégorie met à jour ses pièces ; la supprimer de la liste ne modifie pas les pièces.">
        <CategoriesEditor categories={categories.map((c) => ({ id: c.id, libelle: c.libelle, pieces: parCategorie.get(c.libelle) ?? 0 }))} />
      </SectionParametres>
    </div>
  );
}

async function OngletFiche() {
  const categories = await db.categorieControle.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { points: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
  });
  return (
    <SectionParametres
      titre="Modèle de la fiche de contrôle"
      description="Catégories, colonnes de statut (Ok / Abîmé, Ok / N.C., Ok / À réparer ou case à cocher) et points à vérifier. Chaque ordre de réparation reçoit une copie de ce modèle ; les fiches déjà créées ne sont pas modifiées."
    >
      <CategoriesControleEditor
        categories={categories.map((c) => ({ id: c.id, libelle: c.libelle, typeStatuts: c.typeStatuts, isActive: c.isActive, points: c.points.map((p) => ({ id: p.id, libelle: p.libelle, isActive: p.isActive })) }))}
      />
    </SectionParametres>
  );
}
