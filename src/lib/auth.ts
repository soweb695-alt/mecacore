import "server-only";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { clientIp, estBloque, enregistrerEchec, MAX_TENTATIVES_COMPTE, reinitialiser } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators/auth";

export const BCRYPT_COST = 12;
const HUIT_HEURES = 8 * 60 * 60;

// Hash factice : comparaison à coût constant même si l'e-mail est inconnu.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= bcrypt.hash("mot-de-passe-factice", BCRYPT_COST);
  return dummyHash;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: HUIT_HEURES },
  jwt: { maxAge: HUIT_HEURES },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name:
        process.env.NEXTAUTH_URL?.startsWith("https://")
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: { label: "Adresse e-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Deux compteurs : par IP (bloque un poste) et par compte (bloque une attaque répartie sur plusieurs IP).
        const cle = `login:${clientIp(req?.headers as Record<string, unknown> | undefined)}`;
        const cleCompte = `login-compte:${parsed.data.email}`;
        if ((await estBloque(cle)) || (await estBloque(cleCompte, MAX_TENTATIVES_COMPTE))) throw new Error("TROP_DE_TENTATIVES");

        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? (await getDummyHash()));
        if (!user || !ok || !user.isActive) {
          await enregistrerEchec(cle);
          await enregistrerEchec(cleCompte);
          return null;
        }
        await reinitialiser(cle);
        await reinitialiser(cleCompte);
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
