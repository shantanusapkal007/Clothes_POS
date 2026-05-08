import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Noto_Serif, Inter } from "next/font/google";
import { MobileViewportGuard } from "../components/MobileViewportGuard";
import { Navigation } from "../components/Navigation";
import { PwaRegistrar } from "../components/PwaRegistrar";
import "./globals.css";

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-noto-serif",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Clothing Store POS",
  description: "Fast clothing store POS with editable pricing, stock, tax, and discount.",
  applicationName: "Clothing Store POS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Clothing POS",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#9f1239"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${notoSerif.variable} ${inter.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Clothing POS" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#9f1239" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body text-on-background selection:bg-primary-fixed">
        <PwaRegistrar />
        <MobileViewportGuard />
        <Navigation />
        {children}
      </body>
    </html>
  );
}
