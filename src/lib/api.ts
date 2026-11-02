import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { can, type Action, type Resource } from "@/lib/permissions";

import { lireJson } from "@/lib/body";
import { ApiError } from "@/lib/errors";

export { ApiError };

const MAX_BODY = 1_000_000;

export function jsonError(status: number, message: string, code = "ERREUR", details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

function toResponse(e: unknown) {
  if (e instanceof ApiError) return jsonError(e.status, e.message, e.code, e.details);
  if (e instanceof ZodError) {
    const details = e.issues.map((i) => ({ champ: i.path.join("."), message: i.message }));
    return jsonError(400, details[0]?.message ?? "Données invalides", "VALIDATION", details);
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return jsonError(409, "Cette valeur existe déjà", "DOUBLON");
    if (e.code === "P2025") return jsonError(404, "Élément introuvable", "INTROUVABLE");
    if (e.code === "P2003") return jsonError(409, "Cet élément est référencé ailleurs", "REFERENCE");
  }
  // Aucune donnée sensible dans les logs : on ne journalise que le type d'erreur.
  console.error("[api] erreur interne :", e instanceof Error ? e.name : "inconnue");
  return jsonError(500, "Une erreur est survenue. Réessayez.", "INTERNE");
}

function verifierOrigine(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // appels serveur à serveur / outils : le cookie SameSite=Lax protège déjà
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Origine invalide", "CSRF");
  }
  if (originHost !== host) throw new ApiError(403, "Origine non autorisée", "CSRF");
}

interface Options<B, Q> {
  permission?: [Action, Resource];
  body?: ZodType<B>;
  query?: ZodType<Q>;
}

interface Ctx<B, Q, P> {
  req: NextRequest;
  user: CurrentUser;
  body: B;
  query: Q;
  params: P;
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };

/** Enveloppe commune : session, permission, validation zod, gestion d'erreurs. */
export function route<B = undefined, Q = undefined, P = Record<string, string>>(
  options: Options<B, Q>,
  fn: (ctx: Ctx<B, Q, P>) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: RouteContext) => {
    try {
      verifierOrigine(req);
      const user = await getCurrentUser();
      if (!user) throw new ApiError(401, "Authentification requise", "NON_AUTHENTIFIE");
      if (options.permission && !can(user, options.permission[0], options.permission[1])) {
        throw new ApiError(403, "Accès refusé", "INTERDIT");
      }
      let body = undefined as B;
      if (options.body) {
        // Lecture en flux bornée : un envoi sans Content-Length (chunked) ne contourne pas la limite.
        const raw = await lireJson(req, MAX_BODY);
        if (raw === null) throw new ApiError(400, "Corps JSON invalide", "JSON_INVALIDE");
        body = options.body.parse(raw);
      }
      const query = options.query
        ? options.query.parse(Object.fromEntries(req.nextUrl.searchParams))
        : (undefined as Q);
      const params = (await routeCtx.params) as P;
      const result = await fn({ req, user, body, query, params });
      if (result instanceof Response) return result;
      return NextResponse.json({ data: result ?? null });
    } catch (e) {
      return toResponse(e);
    }
  };
}

export const idParam = z.object({ id: z.string().min(1).max(40) });
export const paginationQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
