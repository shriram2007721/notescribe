import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "NoteScribe",
  description: "Offline-first notes with voice dictation and smart highlights.",
  manifest: "/manifest.json",
  applicationName: "NoteScribe",
  appleWebApp: { capable: true, title: "NoteScribe", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} min-h-screen font-sans`}>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
