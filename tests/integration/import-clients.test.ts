import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";
import { POST as importPost } from "@/app/api/clients/import/route";
import { db } from "@/lib/db";
import { analyserCsv } from "@/lib/import-pieces";
import { importerClients } from "@/lib/services/import-clients";
import { CSV_PENNYLANE } from "../fixtures/pennylane";
import { resetDb } from "./helpers";

let courant: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => courant }));

const rows = () => analyserCsv(CSV_PENNYLANE);

beforeEach(async () => {
  await resetDb();
  courant = { id: "u", role: "ADMIN", email: "a@a.fr", firstName: "A", lastName: "A" };
});

describe("import de clients", () => {
  it("l'aperçu n'écrit rien ; l'import crée les clients sans accord marketing", async () => {
    const apercu = await importerClients(rows(), false);
    expect(apercu).toMatchObject({ crees: 3, misAJour: 0, erreurs: 1 });
    expect(await db.client.count()).toBe(0);
    await importerClients(rows(), true);
    expect(await db.client.count()).toBe(3);
    expect(await db.client.count({ where: { marketingOptIn: true } })).toBe(0);
    expect((await db.client.findUniqueOrThrow({ where: { refExterne: "id-1" } })).paymentTerms).toBe(0);
  });

  it("un réimport met à jour les mêmes fiches, sans doublon et sans effacer les données saisies dans MecaCore", async () => {
    await importerClients(rows(), true);
    const jean = await db.client.findUniqueOrThrow({ where: { refExterne: "id-1" } });
    // Saisi dans MecaCore après l'import : accord marketing, remise, téléphone modifié.
    await db.client.update({ where: { id: jean.id }, data: { marketingOptIn: true, discountRate: 5, phone: "0700000000" } });
    const r = await importerClients(rows(), true);
    expect(r).toMatchObject({ crees: 0, misAJour: 3 });
    expect(await db.client.count()).toBe(3);
    const apres = await db.client.findUniqueOrThrow({ where: { id: jean.id } });
    expect(apres).toMatchObject({ marketingOptIn: true, phone: "0601020304" }); // le fichier fait foi pour ses champs renseignés
    expect(Number(apres.discountRate)).toBe(5);
  });

  it("rapproche un client déjà saisi (même e-mail, ou même nom et code postal) et y mémorise l'identifiant", async () => {
    const parEmail = await db.client.create({ data: { type: "PRO", companyName: "Garage du Pont SARL", email: "contact@pont.fr" } });
    const parNom = await db.client.create({ data: { type: "PARTICULIER", firstName: "jean", lastName: "Dupont", address: "3 rue des Lilas 69001 Lyon" } });
    const r = await importerClients(rows(), true);
    expect(r).toMatchObject({ crees: 1, misAJour: 2 });
    expect((await db.client.findUniqueOrThrow({ where: { id: parEmail.id } })).refExterne).toBe("id-2");
    expect((await db.client.findUniqueOrThrow({ where: { id: parNom.id } })).refExterne).toBe("id-1");
  });

  it("homonymes à la même adresse : deux fiches distinctes, retrouvées chacune au réimport", async () => {
    const csv = [["Identifiant Client", "Prénom", "Nom", "Code Postal", "Liste d’e-mails"], ["h-1", "Marc", "Roux", "69440", "a@x.fr"], ["h-2", "Marc", "Roux", "69440", "b@x.fr"]];
    await importerClients(csv, true);
    await importerClients(csv, true);
    expect(await db.client.count({ where: { lastName: "Roux" } })).toBe(2);
  });

  it("ne modifie ni ne recrée un client anonymisé (droit à l'oubli)", async () => {
    await db.client.create({ data: { type: "PARTICULIER", lastName: "Anonyme", refExterne: "id-1", anonymiseLe: new Date() } });
    const r = await importerClients(rows(), true);
    expect(r.ignores).toBe(1);
    expect(await db.client.count({ where: { lastName: "DUPONT" } })).toBe(0);
  });

  it("route : réservée à l'administrateur", async () => {
    const envoi = () => {
      const fd = new FormData();
      fd.append("fichier", new File([CSV_PENNYLANE], "clients.csv", { type: "text/csv" }));
      fd.append("mode", "apercu");
      return new NextRequest("http://localhost/api/clients/import", { method: "POST", headers: { host: "localhost" }, body: fd });
    };
    const ok = await importPost(envoi(), { params: Promise.resolve({}) });
    expect((await ok.json()).data).toMatchObject({ crees: 3 });
    courant = { id: "u", role: "SECRETARIAT", email: "s@a.fr", firstName: "S", lastName: "S" };
    expect((await importPost(envoi(), { params: Promise.resolve({}) })).status).toBe(403);
  });
});
