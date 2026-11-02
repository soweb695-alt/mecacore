import "server-only";
import { db } from "@/lib/db";
import { smsRappelRdv, emailRappelRdv } from "@/lib/messages/templates";
import { envoyerEmail, envoyerSms, type ResultatEnvoi } from "@/lib/services/messages";
import { ajouterJoursStr, jourParis, parisVersUtc } from "@/lib/time";

/**
 * Envoie les rappels de rendez-vous paramétrés par les campagnes automatiques (J-1, J-7 par défaut).
 * Idempotent : la clé « rdv:ID:Jn:canal » empêche tout double envoi si le cron s'exécute deux fois.
 */
export async function envoyerRappelsRdv(now = new Date()) {
  const campagnes = await db.campagne.findMany({ where: { type: "AUTOMATIQUE", actif: true, joursAvant: { not: null }, declencheur: { startsWith: "RDV_" } } });
  const params = await db.parametreGarage.findUnique({ where: { id: 1 } });
  const garage = params?.nomGarage ?? "Garage";
  const tel = params?.telephone ?? "";
  const aujourdhui = jourParis(now);
  const bilan = { envoyes: 0, ignores: 0, echecs: 0 };

  for (const c of campagnes) {
    const cible = ajouterJoursStr(aujourdhui, c.joursAvant!);
    const rdvs = await db.rendezVous.findMany({
      where: { statut: { in: ["PLANIFIE", "CONFIRME"] }, debut: { gte: parisVersUtc(`${cible}T00:00`), lt: parisVersUtc(`${ajouterJoursStr(cible, 1)}T00:00`) } },
      include: { client: true, vehicule: true },
    });
    for (const r of rdvs) {
      if (r.client.anonymiseLe) continue;
      const cle = `rdv:${r.id}:J${c.joursAvant}:${c.canal}`;
      let res: ResultatEnvoi = "refuse";
      if (c.canal === "SMS" && r.client.phone) {
        res = await envoyerSms({ cle, clientId: r.clientId, template: c.template, destinataire: r.client.phone, message: smsRappelRdv({ garage, debut: r.debut, telephone: tel, joursAvant: c.joursAvant! }) });
      } else if (c.canal === "EMAIL" && r.client.email) {
        const mail = emailRappelRdv({ garage, debut: r.debut, vehicule: `${r.vehicule.marque} ${r.vehicule.modele}`, telephone: tel });
        res = await envoyerEmail({ cle, clientId: r.clientId, template: c.template, destinataire: r.client.email, ...mail });
      }
      if (res === "envoye" || res === "simulation") bilan.envoyes++;
      else if (res === "echec") bilan.echecs++;
      else bilan.ignores++;
    }
  }
  return bilan;
}
