"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

/** Logo du garage : PNG ou JPEG, 1 Mo maximum, imprimé en en-tête des devis, factures et bons de livraison. */
export function LogoUpload({ version }: { version: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function envoyer(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    fd.append("logo", f);
    setPending(true);
    try {
      const res = await fetch("/api/parametres/logo", { method: "POST", body: fd, credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Envoi impossible.");
      toast.success("Logo enregistré");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function retirer() {
    setPending(true);
    try {
      await api("/api/parametres/logo", "DELETE");
      toast.success("Logo retiré");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-24 w-56 items-center justify-center rounded-lg border bg-white p-2">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/parametres/logo?v=${encodeURIComponent(version)}`} alt="Logo du garage" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-muted-foreground">Aucun logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Choisir le logo" onChange={(e) => envoyer(e.target.files?.[0])} />
        <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />}
          {version ? "Remplacer le logo" : "Ajouter un logo"}
        </Button>
        {version && (
          <Button type="button" variant="ghost" disabled={pending} onClick={retirer}>
            <Trash2 aria-hidden />
            Retirer
          </Button>
        )}
        <p className="text-xs text-muted-foreground">PNG ou JPEG, 1 Mo maximum.</p>
      </div>
    </div>
  );
}
