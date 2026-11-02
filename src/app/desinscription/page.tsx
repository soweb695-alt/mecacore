import type { Metadata } from "next";
import { verifierDesinscription } from "@/lib/desinscription";
import { DesinscriptionForm } from "./desinscription-form";

export const metadata: Metadata = { title: "Désinscription", robots: { index: false, follow: false } };

export default async function DesinscriptionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const valide = !!sp.c && !!sp.s && verifierDesinscription(sp.c, sp.s);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">Se désinscrire des offres</h1>
        {valide ? (
          <>
            <p className="mb-5 text-sm text-muted-foreground">Vous ne recevrez plus nos e-mails promotionnels. Vos documents (devis, factures) ne sont pas concernés.</p>
            <DesinscriptionForm c={sp.c!} s={sp.s!} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ce lien de désinscription n&apos;est pas valide ou a expiré. Contactez directement le garage.</p>
        )}
      </div>
    </main>
  );
}
