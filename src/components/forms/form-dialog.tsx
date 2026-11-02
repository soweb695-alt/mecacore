"use client";

import { Loader2 } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CloseContext = createContext<() => void>(() => {});

/** Ferme la fenêtre modale englobante (utilisable depuis les formulaires enfants). */
export const useCloseDialog = () => useContext(CloseContext);

/** Bouton qui ouvre un formulaire en fenêtre modale. les formulaires enfants utilisent `useCloseDialog`. */
export function FormDialog({
  trigger,
  title,
  description,
  children,
  wide,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={(wide ? "sm:max-w-2xl" : "sm:max-w-lg") + " max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
