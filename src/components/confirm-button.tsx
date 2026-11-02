"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/client-api";

/** Action d'API précédée d'une confirmation (suppression, annulation, anonymisation…). */
export function ConfirmButton({
  label,
  title,
  description,
  url,
  method = "DELETE",
  body,
  success,
  variant = "destructive",
  size = "sm",
  redirectTo,
  children,
}: {
  label: string;
  title: string;
  description: string;
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  success: string;
  variant?: "destructive" | "outline" | "default";
  size?: "sm" | "default";
  redirectTo?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      await api(url, method, body);
      toast.success(success);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" variant={variant === "outline" ? "default" : variant} onClick={run} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
