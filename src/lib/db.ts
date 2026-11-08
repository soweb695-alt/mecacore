import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type Client = ReturnType<typeof createClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Client };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL est manquante");
  const adapter = new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 });
  // Le logo (jusqu'à 1 Mo) n'est lu que lorsqu'on le demande explicitement (`select: { logoData: true }`).
  return new PrismaClient({ adapter, omit: { parametreGarage: { logoData: true } }, log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
