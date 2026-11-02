import { describe, expect, it } from "vitest";
import { can, canSeeMargins, navFor, type PermissionUser } from "@/lib/permissions";

const admin: PermissionUser = { id: "a", role: "ADMIN" };
const secretariat: PermissionUser = { id: "s", role: "SECRETARIAT" };
const meca: PermissionUser = { id: "m", role: "MECANICIEN" };

describe("permissions RBAC", () => {
  it("refuse tout utilisateur absent ou de rôle inconnu", () => {
    expect(can(null, "read", "client")).toBe(false);
    expect(can(undefined, "read", "client")).toBe(false);
    expect(can({ id: "x", role: "HACKER" as never }, "read", "client")).toBe(false);
  });

  it("l'admin a accès total", () => {
    expect(can(admin, "delete", "client")).toBe(true);
    expect(can(admin, "read", "analyse")).toBe(true);
    expect(can(admin, "create", "collaborateur")).toBe(true);
    expect(canSeeMargins(admin)).toBe(true);
  });

  it("le secrétariat n'a ni marges, ni gestion des utilisateurs, ni analyse", () => {
    expect(canSeeMargins(secretariat)).toBe(false);
    expect(can(secretariat, "read", "collaborateur")).toBe(false);
    expect(can(secretariat, "read", "analyse")).toBe(false);
    expect(can(secretariat, "create", "devis")).toBe(true);
    expect(can(secretariat, "validate", "devis")).toBe(true);
    expect(can(secretariat, "delete", "client")).toBe(false);
  });

  it("le mécanicien n'accède qu'à ses OR et aux photos", () => {
    expect(can(meca, "read", "ordre", "m")).toBe(true);
    expect(can(meca, "read", "ordre", "autre")).toBe(false);
    expect(can(meca, "update", "ordre", "m")).toBe(true);
    expect(can(meca, "update", "ordre", "autre")).toBe(false);
    expect(can(meca, "create", "photo")).toBe(true);
    for (const r of ["facture", "devis", "piece", "tarif", "client", "analyse", "marge", "paiement"] as const) {
      expect(can(meca, "read", r)).toBe(false);
    }
    expect(canSeeMargins(meca)).toBe(false);
  });

  it("filtre la navigation par rôle", () => {
    expect(navFor(meca).map((i) => i.href)).toEqual(["/ordres-reparation", "/rendez-vous"]);
    expect(can(meca, "create", "rdv")).toBe(false);
    expect(navFor(secretariat).map((i) => i.href)).not.toContain("/parametres");
    expect(navFor(admin).map((i) => i.href)).toContain("/parametres");
    expect(navFor(secretariat).map((i) => i.href)).not.toContain("/collaborateurs");
    expect(navFor(secretariat).map((i) => i.href)).not.toContain("/analyse");
    expect(navFor(admin).map((i) => i.href)).toContain("/collaborateurs");
  });
});
