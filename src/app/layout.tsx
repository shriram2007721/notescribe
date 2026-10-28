import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/app-shell";
import { FeedbackProvider } from "@/components/ui/feedback";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: { default: "NoteScribe", template: "%s · NoteScribe" },
  description: "Offline-first study notes with voice dictation, smart highlights, flashcards and quizzes.",
  manifest: `${base}/manifest.json`,
  applicationName: "NoteScribe",
  appleWebApp: { capable: true, title: "NoteScribe", statusBarStyle: "default" },
  icons: { icon: `${base}/icon.svg`, apple: `${base}/icon.svg` },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1219" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} min-h-screen font-sans`}>
        <FeedbackProvider>
          <AppShell>{children}</AppShell>
        </FeedbackProvider>
      </body>
    </html>
  );
}
