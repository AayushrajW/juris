import { Inter } from "next/font/google";
import { SessionProvider } from "@/hooks/useSession";
import { APP_NAME, DISCLAIMER_SHORT } from "@/lib/constants";
import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
