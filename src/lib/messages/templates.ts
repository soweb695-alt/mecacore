const TZ = "Europe/Paris";
const jour = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);
const heure = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);

/** Échappement HTML : toute donnée insérée dans un e-mail HTML passe par ici. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function smsRappelRdv(p: { garage: string; debut: Date; telephone: string; joursAvant: number }): string {
  const quand = p.joursAvant <= 1 ? "demain" : `le ${jour(p.debut)}`;
  return `${p.garage} : rappel de votre rendez-vous ${quand} à ${heure(p.debut)}. Pour modifier : ${p.telephone}.`;
}

export function emailRappelRdv(p: { garage: string; debut: Date; vehicule: string; telephone: string }) {
  return {
    subject: `Rappel de votre rendez-vous du ${jour(p.debut)}`,
    html: `<p>Bonjour,</p><p>Nous vous rappelons votre rendez-vous au garage <b>${esc(p.garage)}</b> le <b>${esc(jour(p.debut))}</b> à <b>${esc(heure(p.debut))}</b> pour votre véhicule ${esc(p.vehicule)}.</p><p>Pour le modifier : ${esc(p.telephone)}.</p>`,
  };
}

export function smsCommandePrete(p: { garage: string; numero: string; telephone: string }): string {
  return `${p.garage} : votre commande ${p.numero} est prête, vous pouvez venir la retirer. Contact : ${p.telephone}.`;
}

export function emailRecapImpayes(p: { garage: string; lignes: { numero: string; client: string; reste: number; joursRetard: number }[] }) {
  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  const total = p.lignes.reduce((s, l) => s + l.reste, 0);
  const rows = p.lignes
    .map((l) => `<tr><td>${esc(l.numero)}</td><td>${esc(l.client)}</td><td style="text-align:right">${esc(eur(l.reste))}</td><td style="text-align:right">${l.joursRetard} j</td></tr>`)
    .join("");
  return {
    subject: `Factures impayées : ${p.lignes.length} en retard (${eur(total)})`,
    html: `<p>Récapitulatif hebdomadaire des factures impayées de <b>${esc(p.garage)}</b>.</p><table cellpadding="6" border="1" style="border-collapse:collapse"><tr><th>Facture</th><th>Client</th><th>Reste dû</th><th>Retard</th></tr>${rows}</table><p><b>Total : ${esc(eur(total))}</b></p>`,
  };
}

export function emailDevis(p: { garage: string; numero: string; client: string; telephone: string }) {
  return {
    subject: `Votre devis ${p.numero} · ${p.garage}`,
    html: `<p>Bonjour ${esc(p.client)},</p><p>Veuillez trouver ci-joint votre devis <b>${esc(p.numero)}</b>.</p><p>Pour toute question ou pour l'accepter, contactez-nous au ${esc(p.telephone)}.</p><p>Cordialement,<br>${esc(p.garage)}</p>`,
  };
}

export function emailBonLivraison(p: { garage: string; numero: string; client: string; telephone: string }) {
  return {
    subject: `Votre bon de livraison ${p.numero} · ${p.garage}`,
    html: `<p>Bonjour ${esc(p.client)},</p><p>Vous avez récupéré votre commande : veuillez trouver ci-joint le bon de livraison <b>${esc(p.numero)}</b>.</p><p>Pour toute question : ${esc(p.telephone)}.</p><p>Cordialement,<br>${esc(p.garage)}</p>`,
  };
}
