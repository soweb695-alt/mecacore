import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

function cibleSure(valeur: string | string[] | undefined): string {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  // Empêche les redirections ouvertes : chemin interne uniquement.
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statique */}
        <img src="/logo.svg" alt={APP_NAME} className="mb-8 h-12 w-auto" />
        <h1 className="text-xl font-semibold">Connexion</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Avec l&apos;e-mail et le mot de passe fournis par l&apos;administrateur du garage.</p>
        <LoginForm cible={cibleSure(sp.redirige)} />
        <p className="mt-6 text-xs text-muted-foreground">Mot de passe oublié : demandez à l&apos;administrateur de le réinitialiser (menu Collaborateurs).</p>
      </div>
    </div>
  );
}
