"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton, useCloseDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/client-api";
import { couleurCollaborateur } from "@/lib/colors";
import { collaborateurCreation, collaborateurEdition, type CollaborateurCreation, type CollaborateurEdition } from "@/lib/validators/collaborateur";

type Values = CollaborateurCreation & { isActive: boolean };

export function CollaborateurForm({ user }: { user?: { id: string; email: string; firstName: string; lastName: string; role: Values["role"]; isActive: boolean; couleur?: string | null } }) {
  const router = useRouter();
  const close = useCloseDialog();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(user ? (collaborateurEdition as never) : (collaborateurCreation as never)),
    defaultValues: { email: user?.email ?? "", firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", role: user?.role ?? "MECANICIEN", isActive: user?.isActive ?? true, password: "", couleur: user?.couleur ?? "" },
  });

  const couleur = useWatch({ control, name: "couleur" });
  const apercu = couleurCollaborateur(user?.id ?? "nouveau", couleur || null);

  async function onSubmit(v: Values) {
    try {
      if (user) {
        const body: CollaborateurEdition = { firstName: v.firstName, lastName: v.lastName, role: v.role, isActive: v.isActive, password: v.password, couleur: v.couleur || null };
        await api(`/api/collaborateurs/${user.id}`, "PATCH", body);
      } else {
        await api("/api/collaborateurs", "POST", { email: v.email, firstName: v.firstName, lastName: v.lastName, role: v.role, password: v.password, couleur: v.couleur || null });
      }
      toast.success(user ? "Collaborateur mis à jour" : "Collaborateur créé");
      close();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" autoComplete="off" aria-invalid={!!errors.firstName} {...register("firstName")} />
        </Field>
        <Field label="Nom" htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" autoComplete="off" aria-invalid={!!errors.lastName} {...register("lastName")} />
        </Field>
      </div>
      <Field label="Adresse e-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="off" disabled={!!user} aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Rôle" htmlFor="role">
        <NativeSelect id="role" {...register("role")}>
          <option value="ADMIN">Administrateur</option>
          <option value="SECRETARIAT">Magasin</option>
          <option value="MECANICIEN">Atelier</option>
        </NativeSelect>
      </Field>
      <Field label="Couleur du collaborateur" htmlFor="couleur" error={errors.couleur?.message} hint="Utilisée dans le planning, les rendez-vous et l'analyse. Sans choix, une couleur automatique est attribuée.">
        <div className="flex items-center gap-3">
          <input
            id="couleur"
            type="color"
            value={apercu}
            onChange={(e) => setValue("couleur", e.target.value, { shouldValidate: true })}
            className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-card p-1"
            aria-label="Choisir la couleur du collaborateur"
          />
          <span className="size-5 rounded-[3px] border" style={{ background: apercu }} aria-hidden />
          <span className="text-sm tabular-nums text-muted-foreground">{couleur ? apercu.toUpperCase() : "Automatique"}</span>
          {couleur && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setValue("couleur", "")}>
              Couleur automatique
            </Button>
          )}
        </div>
      </Field>
      <Field label={user ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe initial"} htmlFor="password" error={errors.password?.message} hint="12 caractères minimum.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      {user && (
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("isActive")} />
          Compte actif (peut se connecter)
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={close}>
          Annuler
        </Button>
        <SubmitButton pending={isSubmitting}>{user ? "Enregistrer" : "Créer le compte"}</SubmitButton>
      </div>
    </form>
  );
}
