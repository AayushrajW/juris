"use client";

import { Avatar } from "@/components/brand/Avatar";
import { LanguageChoices } from "@/components/i18n/LanguageSwitcher";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import { env } from "@/lib/env";
import { authService } from "@/services";
import { ChevronRight, FileText, LifeBuoy, LogOut, type LucideIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user } = useSession();

  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/documents", label: t("myPapers"), icon: FileText },
    { href: "/legal-aid", label: t("freeHelp"), icon: LifeBuoy },
    // Advocate screens are switched off and not translated. See lib/env.ts.
    ...(env.advocatesEnabled
      ? [
          { href: "/messages", label: "Messages", icon: FileText },
          { href: "/bookmarks", label: "Saved people", icon: FileText },
        ]
      : []),
  ];

  async function signOut() {
    await authService.signOut();
    // A full reload is the point here: it drops everything still held in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <AppPage className="max-w-2xl">
      <PageHeading title={t("title")} />
      <Card className="mt-6">
        <div className="flex items-center gap-3">
          <Avatar name={user?.displayName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[19px] font-semibold text-navy">{user?.displayName}</p>
            <p className="truncate text-[15px] text-muted">{user?.email}</p>
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="text-[17px] font-semibold text-navy">{t("languageTitle")}</h2>
        <LanguageChoices className="mt-3" />
      </section>

      <ul className="mt-6 space-y-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="ns-card flex min-h-14 items-center gap-3 px-4 text-[17px] font-semibold text-navy hover:border-primary/30"
            >
              <item.icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-5 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <Button className="mt-8 w-full" variant="secondary" size="lg" onClick={() => void signOut()}>
        <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
        {t("signOut")}
      </Button>
      <p className="mt-2 text-center text-[14px] text-muted">{t("signOutNote")}</p>
    </AppPage>
  );
}
