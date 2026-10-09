"use client";

import { BrandMark } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { APP_NAME } from "@/lib/constants";
import { useTranslations } from "use-intl";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <BrandMark href="/" />
        <LanguageSwitcher />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <p className="px-4 py-3 text-center text-[13px] text-muted">{t("disclaimerLong", { app: APP_NAME })}</p>
    </div>
  );
}
