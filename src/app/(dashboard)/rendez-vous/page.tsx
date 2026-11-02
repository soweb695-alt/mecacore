import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Planning, type PlanningEvent, type VuePlanning } from "@/components/rdv/planning";
import { couleurCollaborateur } from "@/lib/colors";
import { db } from "@/lib/db";
import { nomClient } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { ajouterJoursStr, jourParis, lundiDe, parisVersUtc, utcVersParis } from "@/lib/time";

export const metadata: Metadata = { title: "Rendez-vous" };

const VUES: VuePlanning[] = ["month", "week", "day"];

/** Jours (YYYY-MM-DD, heure de Paris) couverts par la vue affichée : [début, fin[. */
function plage(vue: VuePlanning, jour: string): [string, string] {
  if (vue === "day") return [jour, ajouterJoursStr(jour, 1)];
  if (vue === "week") return [lundiDe(jour), ajouterJoursStr(lundiDe(jour), 7)];
  // Mois : la grille commence le lundi de la semaine du 1er et finit le dimanche de la semaine du dernier jour.
  const premier = `${jour.slice(0, 7)}-01`;
  const dernier = ajouterJoursStr(`${ajouterJoursStr(premier, 31).slice(0, 7)}-01`, -1);
  return [lundiDe(premier), ajouterJoursStr(lundiDe(dernier), 7)];
}

export default async function RendezVousPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage("read", "rdv");
  const sp = await searchParams;
  const vue = VUES.includes(sp.vue as VuePlanning) ? (sp.vue as VuePlanning) : "week";
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : jourParis();
  const [du, au] = plage(vue, jour);

  // Un mécanicien ne voit que son propre planning, en lecture seule.
  const seulementMoi = user.role === "MECANICIEN";
  const [rdvs, users] = await Promise.all([
    db.rendezVous.findMany({
      where: { ...(seulementMoi ? { userId: user.id } : {}), debut: { lt: parisVersUtc(`${au}T00:00`) }, fin: { gt: parisVersUtc(`${du}T00:00`) } },
      orderBy: { debut: "asc" },
      include: { client: { select: { type: true, firstName: true, lastName: true, companyName: true } }, vehicule: { select: { marque: true, modele: true, immatriculation: true } }, user: { select: { firstName: true, couleur: true } }, devis: { select: { numero: true } } },
    }),
    db.user.findMany({ where: { isActive: true, ...(seulementMoi ? { id: user.id } : {}) }, select: { id: true, firstName: true, lastName: true, couleur: true }, orderBy: { firstName: "asc" } }),
  ]);

  const events: PlanningEvent[] = rdvs.map((r) => ({
    id: r.id, debut: utcVersParis(r.debut), fin: utcVersParis(r.fin), userId: r.userId, collaborateur: r.user.firstName,
    clientId: r.clientId, clientNom: nomClient(r.client), vehiculeId: r.vehiculeId,
    vehicule: `${r.vehicule.marque} ${r.vehicule.modele} · ${r.vehicule.immatriculation}`, motif: r.motif, devisId: r.devisId, devisNumero: r.devis?.numero ?? null, statut: r.statut,
  }));
  // Les collaborateurs inactifs qui portent encore des rendez-vous gardent leur couleur.
  const couleurs = Object.fromEntries([...rdvs.map((r) => [r.userId, couleurCollaborateur(r.userId, r.user.couleur)]), ...users.map((u) => [u.id, couleurCollaborateur(u.id, u.couleur)])]);

  return (
    <>
      <PageHeader title={seulementMoi ? "Mon planning" : "Planning"} description="Rendez-vous de l'atelier, par collaborateur." />
      <Planning
        vue={vue}
        jour={jour}
        events={events}
        couleurs={couleurs}
        peutModifier={can(user, "create", "rdv")}
        collaborateurs={users.map((u) => ({ id: u.id, nom: `${u.firstName} ${u.lastName}`, couleur: couleurs[u.id] }))}
      />
    </>
  );
}
