import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lien de téléchargement (export Excel ou CSV) stylé comme un bouton. */
export function LienTelechargement({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={cn(buttonVariants({ variant: "outline" }))}>
      {children}
    </a>
  );
}
