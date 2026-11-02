import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { lireJson } from "@/lib/body";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { verifierDesinscription } from "@/lib/desinscription";

const body = z.object({ c: z.string().min(1).max(40), s: z.string().length(32) });

/** Désinscription par lien signé : publique (aucune connexion), mais impossible sans la signature du client. */
export async function POST(req: NextRequest) {
  // Route publique : corps borné à quelques Ko (lecture en flux).
  let brut: unknown;
  try {
    brut = await lireJson(req, 4_000);
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
    throw e;
  }
  const parsed = body.safeParse(brut);
  if (!parsed.success || !verifierDesinscription(parsed.data.c, parsed.data.s)) {
    return NextResponse.json({ error: { code: "LIEN_INVALIDE", message: "Ce lien de désinscription n'est pas valide." } }, { status: 400 });
  }
  await db.client.updateMany({ where: { id: parsed.data.c }, data: { marketingOptIn: false } });
  return NextResponse.json({ data: { ok: true } });
}
