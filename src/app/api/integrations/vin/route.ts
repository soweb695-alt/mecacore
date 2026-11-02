import { route } from "@/lib/api";
import { decoderVin } from "@/lib/integrations/vin";
import { vinQuery } from "@/lib/validators/vehicule";

export const GET = route({ permission: ["read", "vehicule"], query: vinQuery }, async ({ query }) => {
  return decoderVin(query.vin); // null → saisie manuelle côté interface
});
