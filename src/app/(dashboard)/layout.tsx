import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { navFor, ROLE_LABELS } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const params = await db.parametreGarage.findUnique({ where: { id: 1 }, select: { nomGarage: true } });
  // OR terminés par l'atelier, à traiter (facturer) par le Magasin : pastille pour l'administrateur et le Magasin.
  const fiches = user.role === "MECANICIEN" ? 0 : await db.ordreReparation.count({ where: { statut: "A_TRAITER_MAGASIN" } });
  const items = navFor(user).map(({ href, label, icon, group }) => ({ href, label, icon, group, badge: href === "/ordres-reparation" ? fiches : undefined }));

  return (
    <AppShell
      items={items}
      role={user.role}
      garage={params?.nomGarage ?? "Garage"}
      user={{
        name: `${user.firstName} ${user.lastName}`,
        initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase(),
        roleLabel: ROLE_LABELS[user.role],
      }}
    >
      {children}
    </AppShell>
  );
}
