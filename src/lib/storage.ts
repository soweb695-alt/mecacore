import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Stockage de fichiers privés (signatures, photos).
 * - Production : bucket S3 compatible (Scaleway, MinIO…) configuré par variables d'environnement.
 * - Développement : dossier local `.storage/` (non versionné) si S3 n'est pas configuré.
 * Les fichiers ne sont jamais publics : ils sont servis par une route authentifiée.
 */
const s3Configure = Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION || "fr-par",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
  });
  return client;
}

const LOCAL_DIR = path.resolve(".storage");

/** Refuse tout chemin qui sortirait du dossier de stockage (traversée de répertoire). */
function cleSure(key: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,200}$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error("Clé de fichier invalide");
  }
  return key;
}

export async function putFichier(key: string, body: Buffer, contentType: string): Promise<void> {
  const k = cleSure(key);
  if (s3Configure) {
    await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: k, Body: body, ContentType: contentType }));
    return;
  }
  const dest = path.join(LOCAL_DIR, k);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
}

export async function getFichier(key: string): Promise<Buffer | null> {
  const k = cleSure(key);
  try {
    if (s3Configure) {
      const res = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: k }));
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    }
    return await readFile(path.join(LOCAL_DIR, k));
  } catch {
    return null;
  }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];
const startsWith = (buf: Buffer, sig: number[]) => sig.every((b, i) => buf[i] === b);

/** Détecte le vrai type d'une image par ses octets magiques (on ne fait pas confiance à l'en-tête client). */
export function typeImage(buf: Buffer): { mime: string; ext: string } | null {
  if (startsWith(buf, PNG)) return { mime: "image/png", ext: "png" };
  if (startsWith(buf, JPG)) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}
