"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

export function LoginForm({ cible }: { cible: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setErreur(null);
    const res = await signIn("credentials", { ...values, redirect: false });
    if (res?.ok && !res.error) {
      router.replace(cible);
      router.refresh();
      return;
    }
    setErreur(
      res?.error === "TROP_DE_TENTATIVES"
        ? "Trop de tentatives. Réessayez dans 15 minutes."
        : "Identifiants incorrects.",
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="prenom@garage.fr"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-erreur" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="email-erreur" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-erreur" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="password-erreur" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        Se connecter
      </Button>
    </form>
  );
}
