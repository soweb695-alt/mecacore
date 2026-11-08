import { route } from "@/lib/api";
import { rechercherOrdres } from "@/lib/services/retours";
import { rechercheOrdreQuery } from "@/lib/validators/retour";

/** Recherche d'ordres de réparation pour le formulaire des retours & consignées. */
export const GET = route({ permission: ["read", "retour"], query: rechercheOrdreQuery }, async ({ query }) => rechercherOrdres(query.q, query.clientId));
