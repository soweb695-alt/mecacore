import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { nomClient } from "@/lib/format";
import { smsRappelRdv } from "@/lib/messages/templates";
import { emailRappelRdvModele } from "@/lib/services/emails-client";
import { envoyerEmail, envoyerSms, type ResultatEnvoi } from "@/lib/services/messages";
import { ajouterJoursStr, jourParis, parisVersUtc } from "@/lib/time";

/** Rappel de rendez-vous à envoyer aujourd'hui (campagnes automatiques J-1, J-7…), en attente de validation. */
export interface RappelAEnvoyer {
  rdvId: string;
  campagneId: string;
  joursAvant: number;
  canal: "EMAIL" | "SMS";
  debut: Date;
  client: string;
  vehicule: string;
  /** Adresse e-mail ou téléphone ; null si le client n'en a pas (rappel impossible). */
  destinataire: string | null;
}

const cleRappel = (rdvId: string, joursAvant: number, canal: string) => `rdv:${rdvId}:J${joursAvant}:${canal}`;

/** Rendez-vous concernés par une campagne de rappel aujourd'hui (RDV dans `joursAvant` jours, encore à venir). */
async function rdvsDuJour(joursAvant: number, now: Date) {
  const cible = ajouterJoursStr(jourParis(now), joursAvant);
  return db.rendezVous.findMany({
    where: { statut: { in: ["PLANIFIE", "CONFIRME"] }, debut: { gte: parisVersUtc(`${cible}T00:00`), lt: parisVersUtc(`${ajouterJoursStr(cible, 1)}T00:00`) } },
    include: { client: true, vehicule: true },
    orderBy: { debut: "asc" },
  });
}

/**
 * Rappels du jour pas encore envoyés. Rien ne part automatiquement : le garage les valide depuis le tableau de bord
 * (un par un ou tous). Un rappel envoyé disparaît de la liste ; un envoi échoué y reste.
 */
export async function rappelsAEnvoyer(now = new Date()): Promise<RappelAEnvoyer[]> {
  const campagnes = await db.campagne.findMany({ where: { type: "AUTOMATIQUE", actif: true, joursAvant: { not: null }, declencheur: { startsWith: "RDV_" } }, orderBy: { joursAvant: "asc" } });
  const out: RappelAEnvoyer[] = [];
  for (const c of campagnes) {
    for (const r of await rdvsDuJour(c.joursAvant!, now)) {
      if (r.client.anonymiseLe) continue;
      out.push({
        rdvId: r.id,
        campagneId: c.id,
        joursAvant: c.joursAvant!,
        canal: c.canal === "SMS" ? "SMS" : "EMAIL",
        debut: r.debut,
        client: nomClient(r.client),
        vehicule: `${r.vehicule.marque} ${r.vehicule.modele} · ${r.vehicule.immatriculation}`,
        destinataire: c.canal === "SMS" ? r.client.phone : r.client.email,
      });
    }
  }
  if (out.length === 0) return out;
  const traites = await db.messageLog.findMany({
    where: { cle: { in: out.map((r) => cleRappel(r.rdvId, r.joursAvant, r.canal)) }, statut: { not: "ECHEC" } },
    select: { cle: true },
  });
  const deja = new Set(traites.map((t) => t.cle));
  return out.filter((r) => !deja.has(cleRappel(r.rdvId, r.joursAvant, r.canal)));
}

/** Envoi d'un rappel validé par le garage. Idempotent : un rappel déjà envoyé n'est pas renvoyé (« deja »). */
export async function envoyerRappelValide(rdvId: string, campagneId: string, now = new Date()): Promise<ResultatEnvoi> {
  const c = await db.campagne.findUnique({ where: { id: campagneId } });
  if (!c || c.type !== "AUTOMATIQUE" || !c.actif || c.joursAvant == null) throw new ApiError(404, "Campagne de rappel introuvable", "INTROUVABLE");
  const r = (await rdvsDuJour(c.joursAvant, now)).find((x) => x.id === rdvId);
  if (!r || r.client.anonymiseLe) throw new ApiError(409, "Ce rappel n'est plus à envoyer aujourd'hui", "RAPPEL_PERIME");
  const cle = cleRappel(r.id, c.joursAvant, c.canal);
  if (c.canal === "SMS") {
    if (!r.client.phone) throw new ApiError(400, "Ce client n'a pas de téléphone", "TELEPHONE_MANQUANT");
    const params = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { nomGarage: true, telephone: true } });
    return envoyerSms({ cle, clientId: r.clientId, template: c.template, destinataire: r.client.phone, message: smsRappelRdv({ garage: params?.nomGarage ?? "Garage", debut: r.debut, telephone: params?.telephone ?? "", joursAvant: c.joursAvant }) });
  }
  if (!r.client.email) throw new ApiError(400, "Ce client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche.", "EMAIL_MANQUANT");
  // Même modèle que le bouton « Rappel RDV » (Paramètres › Communication).
  const mail = await emailRappelRdvModele(r);
  return envoyerEmail({ cle, clientId: r.clientId, template: c.template, destinataire: r.client.email, ...mail });
}
