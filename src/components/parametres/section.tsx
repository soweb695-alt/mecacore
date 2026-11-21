/** Sous-section d'un onglet des Paramètres : titre et explication à gauche, champs à droite (une colonne sur mobile). */
export function SectionParametres({ titre, description, children }: { titre: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t py-6 first:border-t-0 first:pt-0 md:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold">{titre}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </section>
  );
}
