import { describe, expect, it } from "vitest";
import { analyserCsv } from "@/lib/import-pieces";
import { analyserLignesClients, lireConditions } from "@/lib/import-clients";
import { CSV_PENNYLANE } from "../fixtures/pennylane";


describe("import de clients : lecture du fichier", () => {
  it("reconnaît l'export Pennylane et convertit chaque ligne", () => {
    const { lignes, erreurFichier } = analyserLignesClients(analyserCsv(CSV_PENNYLANE));
    expect(erreurFichier).toBeUndefined();
    const [jean, garage, alpha, vide] = lignes;
    expect(jean.valeurs).toMatchObject({
      refExterne: "id-1", type: "PARTICULIER", firstName: "Jean", lastName: "DUPONT",
      email: "jean@exemple.fr", phone: "0601020304", address: "3 rue des Lilas, 69001 Lyon", codePostal: "69001", paymentTerms: 0,
    });
    expect(garage.valeurs).toMatchObject({ type: "PRO", companyName: "GARAGE DU PONT", siret: "832835250", tvaNumber: "FR35832835250", paymentTerms: 30, address: "Zone Nord, 69520 GRIGNY" });
    // Champs invalides ignorés avec un avertissement ; pays étranger ajouté à l'adresse.
    expect(alpha.valeurs).toMatchObject({ type: "PRO", companyName: "Alpha Transports" });
    expect(alpha.valeurs?.siret).toBeUndefined();
    expect(alpha.valeurs?.email).toBeUndefined();
    expect(alpha.avertissements).toHaveLength(2);
    expect(alpha.valeurs?.address).toBe("CH");
    expect(vide.erreurs).toEqual(["Nom ou dénomination manquant."]);
  });

  it("lit un fichier simple (Nom, Prénom, E-mail) et refuse un fichier sans colonne de nom", () => {
    const simple = analyserLignesClients([["Nom", "Prénom", "Email"], ["Martin", "Léa", "lea@exemple.fr"]]);
    expect(simple.lignes[0].valeurs).toMatchObject({ type: "PARTICULIER", firstName: "Léa", lastName: "Martin", email: "lea@exemple.fr" });
    expect(analyserLignesClients([["Email"], ["a@b.fr"]]).erreurFichier).toMatch(/Dénomination/);
  });

  it("signale un identifiant en double dans le fichier", () => {
    const { lignes } = analyserLignesClients([["Identifiant Client", "Dénomination"], ["x", "A"], ["x", "B"]]);
    expect(lignes[1].erreurs[0]).toMatch(/en double/);
  });

  it("convertit les conditions de paiement", () => {
    expect(lireConditions("Payable dès réception")).toBe(0);
    expect(lireConditions("Paiement sous 30 jours")).toBe(30);
    expect(lireConditions("45 jours fin de mois")).toBe(45);
    expect(lireConditions("à convenir")).toBeNull();
  });
});
