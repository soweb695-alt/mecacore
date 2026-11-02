"use client";

export class ApiClientError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: unknown) {
    super(message);
  }
}

/** Appel JSON vers l'API interne ; lève une erreur au message lisible en français. */
export async function api<T = unknown>(url: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let json: { data?: T; error?: { message?: string; code?: string; details?: unknown } } = {};
  try {
    json = await res.json();
  } catch {
    /* corps vide */
  }
  if (!res.ok) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session expirée : rechargement complet vers la connexion
    if (res.status === 401) window.location.href = "/login";
    throw new ApiClientError(json.error?.message ?? "Une erreur est survenue. Réessayez.", res.status, json.error?.code, json.error?.details);
  }
  return json.data as T;
}
