import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { IntlProvider, SkipLink } from "@/components/i18n/IntlProvider";
import { DemoBanner } from "@/components/ui/Display";
import { SessionProvider } from "@/hooks/useSession";
import { loadMessages, requestLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Marathi and Hindi. The browser only downloads it when a page uses the script.
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await loadMessages(await requestLocale());
  return {
    title: {
      default: meta.title.replace("{app}", APP_NAME),
      template: `%s · ${APP_NAME}`,
    },
    description: meta.description.replace("{app}", APP_NAME),
    // Nothing here should be found through a search engine while it is a demo.
    robots: env.demoMode ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#0f2747",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The content security policy carries a fresh nonce per request (proxy.ts),
  // so pages are rendered per request and never prerendered.
  await connection();
  const locale = await requestLocale();
  const messages = await loadMessages(locale);

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${devanagari.variable} min-h-screen antialiased`}>
        <IntlProvider locale={locale} messages={messages}>
          <SkipLink />
          {env.demoMode ? <DemoBanner /> : null}
          <SessionProvider>{children}</SessionProvider>
        </IntlProvider>
      </body>
    </html>
  );
}
