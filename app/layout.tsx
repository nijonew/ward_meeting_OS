import type { Metadata } from "next";
import { Archivo, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getSeasonTheme } from "@/lib/data/season-theme";

// Type pairing from design.md ("The Ledger"): Archivo (display), Public
// Sans (body), JetBrains Mono (utility -- dates, stage text, ledger
// numerals only, never headings or body copy).
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ward Meeting OS",
  description: "Ward meeting agendas, assignments, and sacrament program planning.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // getSessionUser is wrapped in React's cache(), so this adds zero
  // extra Supabase round trips alongside AppHeader's own call within
  // the same request -- the widget mounts only on pages reached after
  // signing in; the fully public, no-login pages render with no user
  // and simply never get it.
  const { user } = await getSessionUser();
  const season = getSeasonTheme();

  return (
    <html lang="en" data-season={season}>
      <body className={`${archivo.variable} ${publicSans.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
        {user && <FeedbackWidget />}
      </body>
    </html>
  );
}
