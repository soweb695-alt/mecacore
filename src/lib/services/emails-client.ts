import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { nomClient } from "@/lib/format";
import { modele, rendreModele, texteHoraires } from "@/lib/messages/modeles-email";
import { envoyerEmail, type ResultatEnvoi } from "@/lib/services/messages";

const TZ = "Europe/Paris";
const dateLongue = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
const heure = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);

/** Variables communes : coordonnées et horaires du garage. */
async function variablesGarage() {
  const g = await db.parametreGarage.findUnique({ where: { id: 1 } });
  return {
    g,
    vars: { garage: g?.nomGarage ?? "Garage", adresse: g?.adresse ?? "", telephone: g?.telephone ?? "", horaires: texteHoraires(g?.horaires) },
  };
}

/** Une simulation (Brevo non configuré) ou un échec est tracé dans l'historique, puis signalé à l'utilisateur. */
function verifierResultat(res: ResultatEnvoi) {
  if (res === "simulation") throw new ApiError(503, "L'envoi d'e-mails n'est pas configuré (clé Brevo manquante). La tentative est notée dans l'historique du client.", "EMAIL_NON_CONFIGURE");
  if (res !== "envoye") throw new ApiError(502, "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant.", "EMAIL_ECHEC");
}

/** Numéro d'envoi : un renvoi volontaire est possible, chaque tentative a sa propre trace. */
async function prochaineCle(prefixe: string) {
  return `${prefixe}:${(await db.messageLog.count({ where: { cle: { startsWith: `${prefixe}:` } } })) + 1}`;
}

/** « Véhicule prêt » : e-mail au client de l'ordre de réparation (modèle de « Mon Garage »), tracé dans son historique. */
export async function envoyerVehiculePret(ordreId: string) {
  const o = await db.ordreReparation.findUnique({ where: { id: ordreId }, include: { devis: { include: { client: true, vehicule: true } } } });
  if (!o) throw new ApiError(404, "Ordre de réparation introuvable", "INTROUVABLE");
  const { client, vehicule } = o.devis;
  if (client.anonymiseLe) throw new ApiError(409, "Ce client a été anonymisé", "CLIENT_ANONYMISE");
  if (!client.email) throw new ApiError(400, "Ce client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche.", "EMAIL_MANQUANT");
  const { g, vars } = await variablesGarage();
  const mail = rendreModele(modele("vehiculePret", { sujet: g?.emailVehiculePretSujet, corps: g?.emailVehiculePretCorps }), {
    ...vars,
    client: nomClient(client),
    vehicule: vehicule ? `${vehicule.marque} ${vehicule.modele}` : "véhicule",
    immatriculation: vehicule?.immatriculation ?? "",
  });
  const res = await envoyerEmail({ cle: await prochaineCle(`vehicule_pret:${o.id}`), clientId: client.id, template: "vehicule_pret", destinataire: client.email, ...mail });
  verifierResultat(res);
  return { destinataire: client.email };
}

/** Variables d'un rendez-vous pour le modèle « Rappel de rendez-vous ». */
export function variablesRdv(r: { debut: Date; client: Parameters<typeof nomClient>[0]; vehicule: { marque: string; modele: string; immatriculation: string } }) {
  return { client: nomClient(r.client), vehicule: `${r.vehicule.marque} ${r.vehicule.modele}`, immatriculation: r.vehicule.immatriculation, date: dateLongue(r.debut), heure: heure(r.debut) };
}

/** Modèle « Rappel de rendez-vous » rendu pour un RDV (envoi manuel et rappels automatiques J-1 / J-7). */
export async function emailRappelRdvModele(r: Parameters<typeof variablesRdv>[0]) {
  const { g, vars } = await variablesGarage();
  return rendreModele(modele("rappelRdv", { sujet: g?.emailRappelRdvSujet, corps: g?.emailRappelRdvCorps }), { ...vars, ...variablesRdv(r) });
}

/** « Rappel RDV » envoyé à la main depuis la fiche du rendez-vous. */
export async function envoyerRappelRdv(rdvId: string) {
  const r = await db.rendezVous.findUnique({ where: { id: rdvId }, include: { client: true, vehicule: true } });
  if (!r) throw new ApiError(404, "Rendez-vous introuvable", "INTROUVABLE");
  if (r.statut === "ANNULE" || r.statut === "HONORE" || r.statut === "NO_SHOW") throw new ApiError(409, "Ce rendez-vous n'est plus à venir", "STATUT_INVALIDE");
  if (r.client.anonymiseLe) throw new ApiError(409, "Ce client a été anonymisé", "CLIENT_ANONYMISE");
  if (!r.client.email) throw new ApiError(400, "Ce client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche.", "EMAIL_MANQUANT");
  const mail = await emailRappelRdvModele(r);
  const res = await envoyerEmail({ cle: await prochaineCle(`rdv_rappel_manuel:${r.id}`), clientId: r.clientId, template: "rdv_rappel_manuel", destinataire: r.client.email, ...mail });
  verifierResultat(res);
  return { destinataire: r.client.email };
}
