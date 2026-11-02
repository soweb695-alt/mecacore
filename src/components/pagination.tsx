import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({ page, pages, params, basePath }: { page: number; pages: number; params: Record<string, string | undefined>; basePath: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} sur {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Précédent
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Suivant
          </Link>
        )}
      </div>
    </nav>
  );
}
