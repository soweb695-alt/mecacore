import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Toaster } from "@/components/ui/sonner";
import { APP_COULEUR, APP_NAME, APP_TAGLINE } from "@/lib/app";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Thème par rôle : la session NextAuth détermine la couleur principale (variables CSS de globals.css).
  const user = await getCurrentUser();
  return (
    <html lang="fr" data-role={user?.role} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="bottom-right" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
