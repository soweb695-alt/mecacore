import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
const cookieName = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

function withSecurity(res: NextResponse) {
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Publics : authentification, crons (protégés par secret) et désinscription (lien signé, sans connexion).
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/cron") || pathname.startsWith("/api/public") || pathname.startsWith("/desinscription")) {
    return withSecurity(NextResponse.next());
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName });

  if (pathname.startsWith("/api/")) {
    if (!token) {
      return withSecurity(
        NextResponse.json(
          { error: { code: "NON_AUTHENTIFIE", message: "Authentification requise" } },
          { status: 401 },
        ),
      );
    }
    return withSecurity(NextResponse.next());
  }

  if (pathname === "/login") {
    if (token) return withSecurity(NextResponse.redirect(new URL("/dashboard", req.url)));
    return withSecurity(NextResponse.next());
  }

  if (!token) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("redirige", pathname);
    return withSecurity(NextResponse.redirect(url));
  }

  if (pathname === "/") {
    return withSecurity(
      NextResponse.redirect(new URL(token.role === "MECANICIEN" ? "/ordres-reparation" : "/dashboard", req.url)),
    );
  }
  return withSecurity(NextResponse.next());
}

export const config = {
  // Fichiers publics (logo, icônes, PWA) : servis sans session, y compris sur la page de connexion.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|offline.html|logo.svg|icon.svg).*)"],
};
