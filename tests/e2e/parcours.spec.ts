import { expect, test } from "@playwright/test";
import { E2E } from "./credentials";
import { login, logout } from "./helpers";

test.describe.configure({ mode: "serial" });

test("1. client → véhicule → devis → validation → OR créé et stock décrémenté", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);

  // Client
  await page.goto("/clients");
  await page.getByRole("button", { name: "Nouveau client" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Prénom", { exact: true }).fill("Sophie");
  await dlg.getByLabel("Nom", { exact: true }).fill("Leroy");
  await dlg.getByLabel("Téléphone").fill("06 12 34 56 78");
  await dlg.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByText("Client créé")).toBeVisible();
  await page.getByRole("link", { name: "Sophie Leroy" }).first().click();

  // Véhicule
  await page.getByRole("button", { name: "Ajouter" }).click();
  const dv = page.getByRole("dialog");
  await dv.getByLabel("Immatriculation").fill("AB-123-CD");
  await dv.getByLabel("Marque").fill("Peugeot");
  await dv.getByLabel("Modèle").fill("308");
  await dv.getByRole("button", { name: "Ajouter le véhicule" }).click();
  await expect(page.getByText("AB-123-CD")).toBeVisible();

  // Devis
  await page.getByRole("link", { name: "Nouveau devis" }).click();
  await page.getByLabel("Véhicule sélectionné").selectOption({ index: 1 });
  await page.getByLabel("Kilométrage").fill("84200");
  await page.locator('select[aria-label="Ajouter : Main d\'œuvre"]').selectOption({ index: 1 });
  await page.getByLabel("Ajouter une pièce du stock").fill("E2E");
  await page.getByRole("option", { name: /E2E-PLAQ/ }).click();
  await page.getByLabel("Quantité").nth(1).fill("3");
  await expect(page.getByText("Total TTC").first()).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
  await expect(page).toHaveURL(/\/devis\/[a-z0-9]+$/);

  // Le devis est créé en « Brouillon » ; il ne passe à « Envoyé » qu'après un envoi d'e-mail réussi.
  await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer par e-mail" })).toBeVisible();
  await page.getByRole("button", { name: "Valider le devis" }).click();
  const val = page.getByRole("dialog");
  await val.getByLabel("Technicien").selectOption({ label: "Youssef Amrani" });
  await val.getByLabel("Début").fill("09:00");
  await val.getByLabel("Fin").fill("10:00");
  await val.getByRole("button", { name: "Confirmer la validation" }).click();
  await expect(page.getByText(/OR-\d{4}-0001 créé/)).toBeVisible();

  // Le rendez-vous est sur le planning du technicien
  await page.goto("/rendez-vous");
  await expect(page.getByRole("button", { name: /09:00.*Sophie Leroy/ })).toBeVisible();

  // OR créé
  await page.goto("/ordres-reparation");
  await expect(page.getByRole("link", { name: /OR-\d{4}-0001/ })).toBeVisible();
  await expect(page.getByText("En attente de signature")).toBeVisible();

  // Stock décrémenté : 5 - 3 = 2 (= seuil d'alerte → alerte visuelle)
  await page.goto("/stock");
  await expect(page.getByText("2 / seuil 2")).toBeVisible();
});

test("2. facture depuis le devis → paiement → statut Payée", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/devis");
  await page.getByRole("link", { name: /DEV-\d{4}-0001/ }).click();
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await page.getByRole("button", { name: "Émettre la facture" }).click();
  await expect(page).toHaveURL(/\/factures\/[a-z0-9]+$/);
  await expect(page.getByText("Émise", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  await page.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(page.getByText("Paiement enregistré")).toBeVisible();
  await expect(page.getByText("Payée", { exact: true }).first()).toBeVisible();
});

test("3. rendez-vous : un créneau en conflit est refusé", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  const creer = async () => {
    await page.goto("/rendez-vous");
    await page.getByRole("button", { name: "Nouveau RDV" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Rechercher un client").fill("Leroy");
    await d.getByRole("option", { name: "Sophie Leroy", exact: true }).click();
    await d.getByLabel("Véhicule").selectOption({ index: 1 });
    await d.getByRole("combobox", { name: "Collaborateur" }).click();
    await d.getByRole("option", { name: "Youssef Amrani" }).click();
    await d.getByLabel("Début").fill("14:00");
    await d.getByLabel("Fin").fill("15:00");
    await d.getByRole("button", { name: "Créer le rendez-vous" }).click();
  };
  await creer();
  await expect(page.getByText("Rendez-vous créé")).toBeVisible();
  await creer();
  await expect(page.getByRole("alert").filter({ hasText: "déjà un rendez-vous" })).toBeVisible();
});

test("4. le mécanicien n'accède ni aux marges ni aux prix d'achat", async ({ page, request }) => {
  const fond = () => page.evaluate(() => getComputedStyle(document.querySelector("aside")!).backgroundColor);

  // L'admin voit marge et prix d'achat. Thème bleu.
  await login(page, E2E.admin.email, E2E.admin.password);
  await expect(page.locator("html")).toHaveAttribute("data-role", "ADMIN");
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Campagnes" })).toBeVisible();
  expect(await fond()).toBe("rgb(29, 95, 209)");
  await page.goto("/stock");
  await expect(page.getByRole("columnheader", { name: "Prix achat HT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Marge" })).toBeVisible();
  await logout(page);

  // Le magasin (rôle SECRETARIAT) : thème par défaut (barre blanche), prix d'achat visible mais pas la marge.
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await expect(page.locator("html")).toHaveAttribute("data-role", "SECRETARIAT");
  expect(await fond()).toBe("rgb(255, 255, 255)");
  await expect(page.getByText("Magasin", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Campagnes" })).toBeVisible();
  await page.goto("/stock");
  await expect(page.getByRole("columnheader", { name: "Prix vente HT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Prix achat HT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Marge" })).toHaveCount(0);
  const stockSec = await page.evaluate(async () => (await fetch("/api/stock")).text());
  expect(stockSec).toMatch(/prixAchatHT/);
  expect(stockSec).not.toMatch(/margePct/);
  await logout(page);

  // L'atelier (rôle MECANICIEN) : thème gris anthracite, navigation réduite, pages et API interdites.
  await login(page, E2E.mecanicien.email, E2E.mecanicien.password);
  await expect(page.locator("html")).toHaveAttribute("data-role", "MECANICIEN");
  expect(await fond()).toBe("rgb(55, 65, 81)");
  await expect(page.getByText("Atelier", { exact: true }).first()).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(nav.getByRole("link", { name: "Rendez-vous" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Campagnes" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Ordres de réparation" })).toBeVisible();
  for (const chemin of ["/stock", "/factures", "/analyse", "/collaborateurs", "/devis", "/tarifs", "/campagnes", "/parametres", "/factures/nouvelle"]) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/ordres-reparation/);
  }
  const statuts = await page.evaluate(async () => {
    const r: Record<string, number> = {};
    for (const u of ["/api/stock", "/api/tarifs", "/api/devis/x/pdf", "/api/factures/x/pdf", "/api/analyse/export?type=factures"]) r[u] = (await fetch(u)).status;
    r["POST /api/collaborateurs"] = (await fetch("/api/collaborateurs", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status;
    r["POST /api/factures/manuelle"] = (await fetch("/api/factures/manuelle", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status;
    r["POST /api/points-controle"] = (await fetch("/api/points-controle", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status;
    r["POST /api/devis"] = (await fetch("/api/devis", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status;
    return r;
  });
  for (const [url, status] of Object.entries(statuts)) expect(status, url).toBe(403);

  // Sans session : 401 sur l'API, redirection sur les pages.
  const anon = await request.get("/api/stock");
  expect(anon.status()).toBe(401);
});

test("5. devis de pièces → bon de livraison en attente ; seuil d'alerte → bon de commande automatique", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/devis/nouveau");
  await page.getByLabel("Type de devis").selectOption("PIECE");
  // Le client se retrouve par la plaque du véhicule.
  await page.getByLabel("Rechercher un véhicule par plaque, VIN ou client").fill("AB-123");
  await page.getByRole("option", { name: /AB-123-CD/ }).click();
  await expect(page.getByText("Sophie Leroy").first()).toBeVisible();
  await page.getByLabel("Ajouter une pièce du stock").fill("E2E");
  await page.getByRole("option", { name: /E2E-PLAQ/ }).click();
  await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
  await expect(page).toHaveURL(/\/devis\/[a-z0-9]+$/);
  await page.getByRole("button", { name: "Valider le devis" }).click();
  await page.getByRole("button", { name: "Confirmer la validation" }).click();
  await expect(page.getByText(/BL-\d{4}-0001 en attente de livraison/)).toBeVisible();

  await page.goto("/bons-livraison");
  await expect(page.getByRole("cell", { name: /^BL-\d{4}-0001/ })).toBeVisible();
  await expect(page.getByText("En attente", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Automatique").first()).toBeVisible();
  await page.getByRole("button", { name: "Prêt à être retiré" }).click();
  await expect(page.getByText("Commande prête à être retirée")).toBeVisible();
  await page.getByRole("button", { name: "Marquer livré" }).click();
  await expect(page.getByText("Commande livrée")).toBeVisible();
});

test("6. la fiche d'un véhicule liste ses devis et factures", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/vehicules");
  await page.getByRole("link", { name: "AB-123-CD" }).first().click();
  await expect(page.getByRole("heading", { name: /AB-123-CD/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /DEV-\d{4}-0001/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /FAC-\d{4}-0001/ })).toBeVisible();
  await expect(page.getByText("84 200 km").first()).toBeVisible();
});

test("7. facturation groupée : bons livrés cochés → une seule facture", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/bons-livraison");
  const ligne = page.getByRole("row", { name: /BL-\d{4}-0001/ });
  await expect(ligne.getByText("Livré", { exact: true })).toBeVisible();
  await page.getByLabel(/Sélectionner BL-\d{4}-0001/).check();
  await page.getByRole("button", { name: "Transformer en facture" }).click();
  await page.getByRole("button", { name: "Émettre la facture" }).click();
  await expect(page).toHaveURL(/\/factures\/[a-z0-9]+$/);
  await expect(page.getByText(/regroupe BL-\d{4}-0001/)).toBeVisible();
});

test("8. client créé à la volée depuis le devis, puis sélectionné automatiquement", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/devis/nouveau");
  await page.getByRole("button", { name: "Nouveau client" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Nom", { exact: true }).fill("Dupont");
  await d.getByLabel("Prénom", { exact: true }).fill("Marie");
  await d.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByText("Client créé")).toBeVisible();
  await expect(page.getByText("Marie Dupont").first()).toBeVisible();
});

test("9. import de pièces : aperçu, puis import des lignes valides ; export disponible", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/stock");
  await expect(page.getByRole("link", { name: /Exporter \(Excel\)/ })).toBeVisible();
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByText("Format attendu")).toBeVisible();
  const fichier = "Référence;Désignation;Prix vente HT;Stock;Seuil d'alerte\nE2E-IMPORT;Pièce importée;19,90;12;3\nE2E-PLAQ;;;4;\nKO;;5;1;\n";
  await d.getByLabel("Choisir un fichier à importer").setInputFiles({ name: "pieces.csv", mimeType: "text/csv", buffer: Buffer.from(fichier, "utf-8") });
  await d.getByRole("button", { name: "Analyser le fichier" }).click();
  await expect(d.getByText("1 à créer")).toBeVisible();
  await expect(d.getByText("1 à mettre à jour")).toBeVisible();
  await expect(d.getByText("1 en erreur")).toBeVisible();
  await expect(d.getByText(/Nouvelle pièce : désignation obligatoire/)).toBeVisible();
  await d.getByRole("button", { name: /Importer 2 lignes valides/ }).click();
  await expect(page.getByText(/1 pièce créée, 1 mise à jour, 1 ligne en erreur/)).toBeVisible();
  await d.getByRole("button", { name: "Fermer" }).click();
  await page.goto("/stock?q=E2E-IMPORT");
  await expect(page.getByRole("cell", { name: "E2E-IMPORT" })).toBeVisible();
});

test("10. client PRO : réduction automatique sur les pièces seulement (pas sur la main d'œuvre)", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/clients");
  await page.getByRole("button", { name: "Nouveau client" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Type de client").selectOption("PRO");
  await d.getByLabel("Raison sociale").fill("Garage Pro E2E");
  await d.getByLabel("Réduction sur les pièces (%)").fill("10");
  await d.getByLabel("Nom du contact", { exact: true }).fill("Pro");
  await d.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByText("Client créé")).toBeVisible();

  await page.goto("/devis/nouveau");
  await page.getByLabel("Type de devis").selectOption("PIECE");
  await page.getByLabel("Rechercher un client", { exact: true }).fill("Garage Pro");
  await page.getByRole("option", { name: "Garage Pro E2E" }).click();
  await page.getByLabel("Ajouter une pièce du stock").fill("E2E-IMPORT");
  await page.getByRole("option", { name: /E2E-IMPORT/ }).click();
  // Prix affichés en TTC : 19,90 HT − 10 % = 17,91 HT, soit 21,49 TTC (catalogue 23,88 TTC).
  await expect(page.getByLabel("Prix unitaire TTC")).toHaveValue("21.49");
  await expect(page.getByText(/17,91.*HT/).first()).toBeVisible();
  await expect(page.getByText(/Catalogue .*23,88.* TTC · remise 10 %/)).toBeVisible();
  await page.locator('select[aria-label="Ajouter : Forfait"]').selectOption("__libre");
  await expect(page.getByLabel("Prix unitaire TTC").nth(1)).toHaveValue("0");
});

test("11. onglet Campagnes : le Magasin prépare une campagne e-mail", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.getByRole("link", { name: "Campagnes" }).click();
  await expect(page).toHaveURL(/\/campagnes$/);
  await page.getByRole("button", { name: "Nouvelle campagne" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Nom de la campagne (usage interne)").fill("Pneus hiver");
  await d.getByLabel("Objet de l'e-mail").fill("-15 % sur les pneus d'hiver");
  await d.getByLabel("Message").fill("Bonjour {prenom},\n\nProfitez de -15 % sur les pneus d'hiver jusqu'au 30 novembre.");
  await d.getByRole("button", { name: "Créer la campagne" }).click();
  await expect(page.getByText("Campagne créée")).toBeVisible();
  await expect(page.getByRole("row", { name: /Pneus hiver/ }).getByText("Brouillon")).toBeVisible();
  await expect(page.getByText(/clé Brevo manquante/)).toBeVisible();
});

test("12. OR : travaux, fiche de contrôle et kilométrage par l'atelier, puis facture brouillon émise par le Magasin", async ({ page }) => {
  // Le Magasin crée et valide un devis mécanique : nouvel OR pour Youssef.
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/clients");
  await page.getByRole("link", { name: "Sophie Leroy" }).first().click();
  await page.getByRole("link", { name: "Nouveau devis" }).click();
  await page.getByLabel("Véhicule sélectionné").selectOption({ index: 1 });
  await page.getByLabel("Kilométrage").fill("84200");
  await page.locator('select[aria-label="Ajouter : Main d\'œuvre"]').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
  await expect(page).toHaveURL(/\/devis\/[a-z0-9]+$/);
  await page.getByRole("button", { name: "Valider le devis" }).click();
  const val = page.getByRole("dialog");
  await val.getByLabel("Technicien").selectOption({ label: "Youssef Amrani" });
  await val.getByLabel("Début").fill("16:00");
  await val.getByLabel("Fin").fill("17:00");
  await val.getByRole("button", { name: "Confirmer la validation" }).click();
  const cree = page.getByText(/OR-\d{4}-\d{4} créé/);
  await expect(cree).toBeVisible();
  const numeroOr = (await cree.textContent())!.match(/OR-\d{4}-\d{4}/)![0];
  await logout(page);

  // L'atelier : signature du client, démarrage, fiche de contrôle, fin des travaux avec le kilométrage.
  await login(page, E2E.mecanicien.email, E2E.mecanicien.password);
  await page.getByRole("link", { name: "Rendez-vous" }).click();
  await expect(page.getByRole("heading", { name: "Mon planning" })).toBeVisible();
  await page.goto("/ordres-reparation");
  await page.getByRole("link", { name: new RegExp(numeroOr) }).click();
  await expect(page).toHaveURL(/\/ordres-reparation\/[a-z0-9]+$/);
  const signe = await page.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    return (await fetch(`/api/ordres-reparation/${id}/signature`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) })).status;
  });
  expect(signe).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: "Démarrer les travaux" }).click();
  await expect(page.getByText("Travaux démarrés")).toBeVisible();
  await expect(page.getByRole("button", { name: "Terminer l'ordre" })).toBeDisabled();
  await expect(page.getByText("Validez d'abord la fiche de contrôle ci-dessous.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Valider et transmettre au Magasin" })).toBeDisabled();
  const ok = page.getByRole("button", { name: "OK", exact: true });
  const n = await ok.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await ok.nth(i).click();
  await page.getByLabel("Remarques").fill("Pneus avant à surveiller");
  await page.getByRole("button", { name: "Valider et transmettre au Magasin" }).click();
  await expect(page.getByText("Fiche transmise au Magasin")).toBeVisible();
  await page.getByRole("button", { name: "Terminer l'ordre" }).click();
  const fin = page.getByRole("dialog");
  await expect(fin.getByLabel("Kilométrage au compteur")).toHaveValue("84200");
  await fin.getByLabel("Kilométrage au compteur").fill("84350");
  await fin.getByRole("button", { name: "Terminer et transmettre" }).click();
  await expect(page.getByText("Ordre terminé et transmis au Magasin")).toBeVisible();
  await expect(page.getByText("À traiter par le Magasin").first()).toBeVisible();
  await logout(page);

  // Le Magasin : alerte, pastille, onglet dédié ; il finalise puis émet la facture préparée.
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await expect(page.getByText(`${numeroOr} à traiter par le Magasin`)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByLabel("1 à traiter")).toBeVisible();
  await page.goto("/ordres-reparation?vue=magasin");
  await expect(page.getByRole("link", { name: numeroOr })).toBeVisible();
  await expect(page.getByText("84 350 km")).toBeVisible();
  await page.getByRole("link", { name: "Finaliser la facture" }).click();
  await expect(page.getByRole("heading", { name: /Facture à émettre/ })).toBeVisible();
  await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Émettre la facture" }).click();
  await expect(page.getByText(/Facture FAC-\d{4}-\d{4} émise/)).toBeVisible();
  await expect(page.getByText("Émise", { exact: true })).toBeVisible();
  await page.goto("/ordres-reparation?vue=magasin");
  await expect(page.getByText("Aucun ordre de réparation à traiter.")).toBeVisible();
});

test("13. administrateur : Mon Garage (coordonnées, IBAN / BIC), points de contrôle ; facture manuelle avec remise globale et virement", async ({ page }) => {
  await login(page, E2E.admin.email, E2E.admin.password);
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Mon Garage" }).click();
  await page.getByLabel("Téléphone").fill("04 78 00 00 00");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText("Informations du garage enregistrées")).toBeVisible();
  await page.getByLabel("IBAN").fill("FR14 2004 1010 0505 0001 3M02 606");
  await page.getByLabel("BIC").fill("PSSTFRPP");
  await page.getByRole("button", { name: "Enregistrer" }).last().click();
  await expect(page.getByText("Coordonnées bancaires enregistrées")).toBeVisible();
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Paramètres" }).click();
  await page.getByLabel("Nouveau point de contrôle").fill("Géométrie");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Point ajouté")).toBeVisible();
  await expect(page.getByLabel(/Libellé du point/).last()).toHaveValue("Géométrie");

  // Facture manuelle : client, ligne libre, remise de 10 % sur le HT, règlement par virement.
  await page.goto("/factures");
  await page.getByRole("link", { name: "Nouvelle facture" }).click();
  await page.getByLabel("Rechercher un client", { exact: true }).fill("Sophie");
  await page.getByRole("option", { name: /Sophie Leroy/ }).click();
  await page.getByRole("button", { name: "Main d'œuvre" }).click();
  await page.getByLabel("Désignation").fill("Diagnostic électronique");
  await page.getByLabel("PU HT (€)").fill("100");
  await page.getByLabel("Remise globale").fill("10");
  await page.getByLabel("Mode de règlement prévu").selectOption("VIREMENT");
  await expect(page.getByText("120,00").first()).not.toBeVisible();
  await expect(page.getByText(/108,00/).first()).toBeVisible(); // 100 − 10 % = 90 HT → 108 € TTC
  await page.getByRole("button", { name: "Émettre la facture" }).click();
  await expect(page).toHaveURL(/\/factures\/[a-z0-9]+$/);
  await expect(page.getByText("saisie manuelle")).toBeVisible();
  await expect(page.getByText(/Remise 10 % \(sur HT\)/)).toBeVisible();
  await expect(page.getByText("L'IBAN et le BIC du garage figurent sur le PDF.")).toBeVisible();
  const pdf = await page.evaluate(async () => {
    const id = location.pathname.split("/").pop();
    const r = await fetch(`/api/factures/${id}/pdf`);
    return { status: r.status, type: r.headers.get("content-type") };
  });
  expect(pdf).toEqual({ status: 200, type: "application/pdf" });
});

test("14. factures : export de la sélection (Excel et PDF groupé) ; onglet Relances", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/factures");
  await expect(page.getByRole("button", { name: "Exporter la sélection (Excel)" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Tout sélectionner sur cette page" }).check();
  await expect(page.getByText(/\d+ factures? sélectionnées?/)).toBeVisible();
  const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter la sélection (Excel)" }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^factures-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF groupé" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Relances" }).click();
  await expect(page.getByRole("heading", { name: "Relances" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Nombre de relances" })).toBeVisible();
});

test("15. devis : nouvelle pièce créée à la volée, prix TTC, brouillon ; puis un retour consigné rattaché au client", async ({ page }) => {
  await login(page, E2E.secretariat.email, E2E.secretariat.password);
  await page.goto("/devis/nouveau");
  await page.getByLabel("Type de devis").selectOption("PIECE");
  await page.getByLabel("Rechercher un client", { exact: true }).fill("Sophie");
  await page.getByRole("option", { name: /Sophie Leroy/ }).first().click();

  await page.getByRole("button", { name: "Nouvelle pièce" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Référence").fill("E2E-RAPIDE");
  await d.getByLabel("Nom").fill("Ampoule H7");
  await d.getByLabel("Prix d'achat HT (€)").fill("3");
  await d.getByLabel("Prix de vente HT (€)").fill("10");
  await d.getByLabel("Stock initial").fill("1");
  await d.getByRole("button", { name: "Créer et ajouter au devis" }).click();
  await expect(page.getByLabel("Prix unitaire TTC")).toHaveValue("12");

  // Stock insuffisant : alerte visible, mais l'enregistrement n'est pas bloqué.
  await page.getByLabel("Quantité").fill("3");
  await expect(page.getByText(/il manquera 2 pièces/)).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer en brouillon" }).click();
  await expect(page).toHaveURL(/\/devis\/[a-z0-9]+$/);
  await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();

  // Retour consigné rattaché au client.
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Retours & Consignées" }).click();
  await page.getByRole("button", { name: "Nouveau retour" }).click();
  const r = page.getByRole("dialog");
  await r.getByLabel("Type").selectOption("CONSIGNE");
  await r.getByLabel("Désignation").fill("Étrier échange standard");
  await r.getByLabel("Montant de la consigne HT (€)").fill("45");
  await r.getByLabel("Rechercher un client").fill("Sophie");
  await page.getByRole("option", { name: /Sophie Leroy/ }).first().click();
  await r.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText(/RET-\d{4}-0001 enregistré/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Étrier échange standard/ })).toContainText("Sophie Leroy");
  await expect(page.getByText("45,00 €").first()).toBeVisible();
});
