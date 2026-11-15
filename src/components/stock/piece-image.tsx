"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

/** URL de l'image d'une pièce, versionnée par sa date d'envoi (cache navigateur longue durée). */
export const urlImagePiece = (id: string, version: Date | string) => `/api/stock/${id}/image?v=${encodeURIComponent(new Date(version).getTime())}`;

/** Vignette carrée pour les listes ; rien si la pièce n'a pas d'image. */
export function VignettePiece({ id, version, nom }: { id: string; version: Date | string | null; nom: string }) {
  if (!version) return <span className="block size-10 shrink-0 rounded-md bg-muted" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API, déjà au bon format
  return <img src={urlImagePiece(id, version)} alt={nom} loading="lazy" className="size-10 shrink-0 rounded-md border bg-white object-contain" />;
}

/** Image de la fiche pièce : affichage, envoi (PNG, JPEG ou WebP, 2 Mo) et retrait. */
export function PieceImage({ id, nom, version, modifiable }: { id: string; nom: string; version: string | null; modifiable: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function envoyer(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) return void toast.error("Image trop volumineuse (2 Mo maximum)");
    const fd = new FormData();
    fd.append("image", f);
    setPending(true);
    try {
      const res = await fetch(`/api/stock/${id}/image`, { method: "POST", body: fd, credentials: "same-origin" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Envoi impossible.");
      toast.success("Image enregistrée");
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
      await api(`/api/stock/${id}/image`, "DELETE");
      toast.success("Image retirée");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex aspect-square w-full max-w-64 items-center justify-center rounded-lg border bg-white p-2">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element -- image servie par l'API
          <img src={urlImagePiece(id, version)} alt={nom} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-muted-foreground">Pas d&apos;image</span>
        )}
      </div>
      {modifiable && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choisir l'image de la pièce" onChange={(e) => envoyer(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />}
            {version ? "Remplacer l'image" : "Ajouter une image"}
          </Button>
          {version && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={retirer}>
              <Trash2 aria-hidden />
              Retirer
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">PNG, JPEG ou WebP, 2 Mo maximum.</p>
        </div>
      )}
    </div>
  );
}
