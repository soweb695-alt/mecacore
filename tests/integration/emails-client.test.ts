import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { creerDevis, validerDevis } from "@/lib/services/devis";
import { envoyerRappelRdv, envoyerVehiculePret } from "@/lib/services/emails-client";
import { enregistrerRdv } from "@/lib/services/rdv";
import { creneau, ligne, resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
const fetchMock = vi.fn();

beforeEach(async () => {
  await resetDb();
  b = await seedBase();
  vi.stubEnv("BREVO_API_KEY", "cle-brevo");
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const corpsEnvoye = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);

describe("e-mail « Véhicule prêt »", () => {
  it("utilise le modèle de « Mon Garage » (horaires compris) et trace l'envoi dans l'historique du client", async () => {
    await db.parametreGarage.update({
      where: { id: 1 },
      data: { horaires: { lundi: "08:00-18:00", dimanche: "fermé" }, emailVehiculePretSujet: "{immatriculation} est prêt", emailVehiculePretCorps: "Bonjour {client}\n\n{horaires}" },
    });
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    const { ordre } = await validerDevis(id, creneau(b.meca.id));
    await envoyerVehiculePret(ordre!.id);
    const mail = corpsEnvoye();
    expect(mail.subject).toBe("AB-123-CD est prêt");
    expect(mail.htmlContent).toBe("<p>Bonjour Jean Durand</p><p>Lundi : 08:00-18:00<br>Dimanche : fermé</p>");
    const log = await db.messageLog.findFirstOrThrow({ where: { template: "vehicule_pret" } });
    expect(log).toMatchObject({ clientId: b.client.id, canal: "EMAIL", statut: "ENVOYE", destinataire: "j@d.fr" });
    // Un second envoi volontaire est possible et tracé à part.
    await envoyerVehiculePret(ordre!.id);
    expect(await db.messageLog.count({ where: { template: "vehicule_pret" } })).toBe(2);
  });

  it("signale un client sans e-mail et une clé Brevo absente (tentative tracée)", async () => {
    const { id } = await creerDevis(b.user.id, { type: "MECANIQUE", clientId: b.client.id, vehiculeId: b.vehicule.id, lignes: [ligne(b.p1.id, 1)] });
    const { ordre } = await validerDevis(id, creneau(b.meca.id));
    vi.stubEnv("BREVO_API_KEY", "");
    await expect(envoyerVehiculePret(ordre!.id)).rejects.toMatchObject({ code: "EMAIL_NON_CONFIGURE" });
    expect(await db.messageLog.count({ where: { template: "vehicule_pret", statut: "IGNORE" } })).toBe(1);
    await db.client.update({ where: { id: b.client.id }, data: { email: null } });
    await expect(envoyerVehiculePret(ordre!.id)).rejects.toMatchObject({ code: "EMAIL_MANQUANT" });
  });
});

describe("e-mail « Rappel RDV »", () => {
  it("envoie le texte par défaut avec date et heure, refuse un rendez-vous annulé", async () => {
    const { id } = await enregistrerRdv({ clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id, debut: "2027-06-14T09:30", fin: "2027-06-14T10:30" });
    await envoyerRappelRdv(id);
    const mail = corpsEnvoye();
    expect(mail.subject).toBe("Rappel : rendez-vous le lundi 14 juin à 09:30");
    expect(mail.htmlContent).toContain("Peugeot 308 (AB-123-CD)");
    expect(await db.messageLog.count({ where: { template: "rdv_rappel_manuel", clientId: b.client.id } })).toBe(1);
    await db.rendezVous.update({ where: { id }, data: { statut: "ANNULE" } });
    await expect(envoyerRappelRdv(id)).rejects.toMatchObject({ code: "STATUT_INVALIDE" });
  });
});
