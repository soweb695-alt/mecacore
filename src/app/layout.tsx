import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Toaster } from "@/components/ui/sonner";
import { APP_COULEUR, APP_NAME, APP_TAGLINE } from "@/lib/app";
import "./globals.css";

// IBM Plex Sans : lisible sur tablette d'atelier, chiffres tabulaires nets pour les montants.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `${APP_TAGLINE} : clients, devis, ordres de réparation, stock et factures.`,
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: APP_COULEUR,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${plexSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="bottom-right" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
