import { Inter } from "next/font/google";
import { DemoBanner } from "@/components/ui/Display";
import { SessionProvider } from "@/hooks/useSession";
import { APP_NAME, DISCLAIMER_SHORT } from "@/lib/constants";
import { env } from "@/lib/env";
import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Your Legal Companion`,
    template: `%s · ${APP_NAME}`,
  },
  description: DISCLAIMER_SHORT,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The content security policy carries a fresh nonce per request (proxy.ts),
  // so pages are rendered per request and never prerendered.
  await connection();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${inter.variable} min-h-screen antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {env.demoMode ? <DemoBanner /> : null}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
