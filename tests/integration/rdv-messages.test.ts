import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { envoyerSms } from "@/lib/services/messages";
import { enregistrerRdv } from "@/lib/services/rdv";
import { envoyerRappelsRdv } from "@/lib/services/rappels";
import { ajouterJoursStr, jourParis } from "@/lib/time";
import { resetDb, seedBase } from "./helpers";

let b: Awaited<ReturnType<typeof seedBase>>;
beforeEach(async () => {
  await resetDb();
  b = await seedBase();
});

const base = () => ({ clientId: b.client.id, vehiculeId: b.vehicule.id, userId: b.meca.id });

describe("rendez-vous", () => {
  it("refuse un créneau qui chevauche un autre rendez-vous du même collaborateur", async () => {
    await enregistrerRdv({ ...base(), debut: "2026-11-10T09:00", fin: "2026-11-10T10:30" });
    for (const [d, f] of [["2026-11-10T10:00", "2026-11-10T11:00"], ["2026-11-10T08:00", "2026-11-10T09:30"], ["2026-11-10T09:15", "2026-11-10T10:00"], ["2026-11-10T08:00", "2026-11-10T12:00"]]) {
      await expect(enregistrerRdv({ ...base(), debut: d, fin: f })).rejects.toMatchObject({ status: 409, code: "CONFLIT_RDV" });
    }
  });
  it("accepte des créneaux contigus et un autre collaborateur", async () => {
    await enregistrerRdv({ ...base(), debut: "2026-11-10T09:00", fin: "2026-11-10T10:00" });
    await expect(enregistrerRdv({ ...base(), debut: "2026-11-10T10:00", fin: "2026-11-10T11:00" })).resolves.toBeDefined();
    await expect(enregistrerRdv({ ...base(), userId: b.user.id, debut: "2026-11-10T09:00", fin: "2026-11-10T10:00" })).resolves.toBeDefined();
  });
  it("ignore les rendez-vous annulés et permet de déplacer un rendez-vous sur lui-même", async () => {
    const { id } = await enregistrerRdv({ ...base(), debut: "2026-11-10T09:00", fin: "2026-11-10T10:00" });
    await expect(enregistrerRdv({ ...base(), debut: "2026-11-10T09:30", fin: "2026-11-10T10:30" }, id)).resolves.toBeDefined();
    await db.rendezVous.update({ where: { id }, data: { statut: "ANNULE" } });
    await expect(enregistrerRdv({ ...base(), debut: "2026-11-10T09:00", fin: "2026-11-10T10:00" })).resolves.toBeDefined();
  });
  it("une seule création gagne en cas de requêtes simultanées", async () => {
    const res = await Promise.allSettled([1, 2, 3].map(() => enregistrerRdv({ ...base(), debut: "2026-11-11T09:00", fin: "2026-11-11T10:00" })));
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.rendezVous.count()).toBe(1);
  });
  it("refuse un véhicule d'un autre client", async () => {
    const autre = await db.client.create({ data: { type: "PARTICULIER", lastName: "Autre" } });
    await expect(enregistrerRdv({ ...base(), clientId: autre.id, debut: "2026-11-10T09:00", fin: "2026-11-10T10:00" })).rejects.toMatchObject({ code: "VEHICULE_INVALIDE" });
  });
});

describe("messages et rappels", () => {
  it("envoie les rappels J-1 / J-7 une seule fois (idempotent) et les trace dans MessageLog", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { phone: "06 12 34 56 78", email: "j@d.fr" } });
    await db.campagne.createMany({
      data: [
        { nom: "J-1", type: "AUTOMATIQUE", template: "rdv_rappel_j1", declencheur: "RDV_J1", joursAvant: 1, canal: "SMS" },
        { nom: "J-7", type: "AUTOMATIQUE", template: "rdv_rappel_j7", declencheur: "RDV_J7", joursAvant: 7, canal: "EMAIL" },
      ],
    });
    const demain = ajouterJoursStr(jourParis(), 1);
    const j7 = ajouterJoursStr(jourParis(), 7);
    await enregistrerRdv({ ...base(), debut: `${demain}T14:00`, fin: `${demain}T15:00` });
    await enregistrerRdv({ ...base(), userId: b.user.id, debut: `${j7}T09:00`, fin: `${j7}T10:00` });

    const r1 = await envoyerRappelsRdv();
    const r2 = await envoyerRappelsRdv();
    expect(r1.envoyes).toBe(2);
    expect(r2.envoyes).toBe(0);
    const logs = await db.messageLog.findMany({ orderBy: { canal: "asc" } });
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.canal).sort()).toEqual(["EMAIL", "SMS"]);
    expect(logs.every((l) => l.clientId === b.client.id)).toBe(true);
  });
  it("n'envoie pas de rappel pour un rendez-vous annulé", async () => {
    await db.client.update({ where: { id: b.client.id }, data: { phone: "0612345678" } });
    await db.campagne.create({ data: { nom: "J-1", type: "AUTOMATIQUE", template: "rdv_rappel_j1", declencheur: "RDV_J1", joursAvant: 1, canal: "SMS" } });
    const demain = ajouterJoursStr(jourParis(), 1);
    const { id } = await enregistrerRdv({ ...base(), debut: `${demain}T14:00`, fin: `${demain}T15:00` });
    await db.rendezVous.update({ where: { id }, data: { statut: "ANNULE" } });
    expect((await envoyerRappelsRdv()).envoyes).toBe(0);
  });
  it("refuse un message marketing sans consentement RGPD", async () => {
    const e = { cle: "camp:1", clientId: b.client.id, template: "promo", destinataire: "0612345678", message: "Promo", marketing: true };
    expect(await envoyerSms(e)).toBe("refuse");
    expect(await db.messageLog.count()).toBe(0);
    await db.client.update({ where: { id: b.client.id }, data: { marketingOptIn: true } });
    expect(await envoyerSms({ ...e, cle: "camp:2" })).toBe("simulation"); // aucune clé SMS Partner en test
    expect(await db.messageLog.count()).toBe(1);
  });
});
