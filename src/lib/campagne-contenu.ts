import { esc } from "@/lib/messages/templates";

/**
 * Transforme le texte saisi en e-mail HTML : tout est échappé (aucun HTML saisi n'est interprété),
 * les paragraphes sont séparés par une ligne vide, {prenom} / {nom} / {garage} sont remplacés.
 */
export function rendreCampagneHtml(contenu: string, vars: { prenom: string; nom: string; garage: string }, lienDesinscription: string, adresseGarage: string): string {
  const remplace = (t: string) => t.replace(/\{prenom\}/gi, vars.prenom).replace(/\{nom\}/gi, vars.nom).replace(/\{garage\}/gi, vars.garage);
  const paragraphes = contenu
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(remplace(p.trim())).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14181f">${paragraphes}<hr style="border:none;border-top:1px solid #e3e6ec;margin:24px 0 12px"><p style="font-size:12px;color:#566070;margin:0">Vous recevez cet e-mail car vous avez accepté de recevoir les offres de ${esc(vars.garage)}${adresseGarage ? ` (${esc(adresseGarage)})` : ""}.<br><a href="${esc(lienDesinscription)}">Se désinscrire</a></p></div>`;
}
