import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { pieceCreationSchema, pieceListQuery } from "@/lib/validators/piece";
import { verifierReapprovisionnement } from "@/lib/services/reappro";
import { categorieCanonique, pieceData, pieceVue, rechercherPieces } from "@/lib/services/pieces";

export const GET = route({ permission: ["read", "piece"], query: pieceListQuery }, async ({ query, user }) =>
  rechercherPieces(user, { q: query.q, categorie: query.categorie, bas: query.bas === "1", page: query.page }),
);

export const POST = route({ permission: ["create", "piece"], body: pieceCreationSchema }, async ({ body, user }) => {
  // Catégorie nouvelle : ajoutée à la liste des Paramètres ; existante : même écriture que la liste.
  const categorie = await categorieCanonique(db, body.categorie);
  const p = await db.piece.create({ data: pieceData({ ...body, categorie: categorie ?? "" }, user, true) });
  await db.$transaction((tx) => verifierReapprovisionnement(tx, [p.id]));
  return pieceVue(p, user);
});
