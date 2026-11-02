import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { pieceListQuery, pieceSchema } from "@/lib/validators/piece";
import { verifierReapprovisionnement } from "@/lib/services/reappro";
import { pieceData, pieceVue, rechercherPieces } from "@/lib/services/pieces";

export const GET = route({ permission: ["read", "piece"], query: pieceListQuery }, async ({ query, user }) =>
  rechercherPieces(user, { q: query.q, categorie: query.categorie, bas: query.bas === "1", page: query.page }),
);

export const POST = route({ permission: ["create", "piece"], body: pieceSchema }, async ({ body, user }) => {
  const p = await db.piece.create({ data: pieceData(body, user, true) });
  await db.$transaction((tx) => verifierReapprovisionnement(tx, [p.id]));
  return pieceVue(p, user);
});
