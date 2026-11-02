"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production uniquement) pour rendre l'application installable. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
