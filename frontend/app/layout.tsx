import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/lib/session-context";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Borne d'Accès Numérique - Borne Multiservice",
  description: "Imprimez vos documents en toute simplicité depuis votre mobile.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Borne Service",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E2761",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${outfit.variable} font-sans h-full antialiased`}>
      <body className="min-h-full bg-[#F5F7FF] text-[#121630] flex flex-col">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
