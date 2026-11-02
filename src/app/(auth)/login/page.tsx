import type { Metadata } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/app";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-card p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG statique */}
            <img src="/logo.svg" alt={APP_NAME} className="h-16 w-auto" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">{APP_TAGLINE}</p>
          </div>
          <h1 className="text-2xl font-semibold">Connexion</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Connectez-vous pour accéder à votre espace.</p>
          <LoginForm cible={cibleSure(sp.redirige)} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Mot de passe oublié ? Contactez votre administrateur.
          </p>
        </div>
      </div>
      <div className="hidden flex-col justify-center bg-primary p-16 text-primary-foreground lg:flex">
        <h2 className="mb-5 text-3xl font-semibold leading-tight">
          Devis, ordres de réparation, stock et factures au même endroit.
        </h2>
        <ul className="list-disc space-y-2.5 pl-5 opacity-95">
          <li>Fini les doubles saisies et le papier</li>
          <li>Stock mis à jour dès la validation du devis</li>
          <li>Ordres de réparation suivis sur tablette par l&apos;atelier</li>
          <li>Factures et relances suivies automatiquement</li>
        </ul>
      </div>
    </div>
  );
}
