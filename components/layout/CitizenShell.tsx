"use client";

import { Avatar } from "@/components/brand/Avatar";
import { BrandMark } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Button } from "@/components/ui/Button";
import { Alert, DisclaimerBar } from "@/components/ui/Display";
import { useErrorText } from "@/hooks/useErrorText";
import { useSession } from "@/hooks/useSession";
import { CITIZEN_NAV, HELP_HREF } from "@/lib/constants";
import { cn } from "@/lib/cn";
import {
  ChevronRight,
  FolderOpen,
  Home,
  LifeBuoy,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const navIcons: Record<string, LucideIcon> = {
  "/dashboard": Home,
  "/cases": FolderOpen,
  "/assistant": MessageCircle,
  [HELP_HREF]: LifeBuoy,
};

const HELP_SECTIONS = ["/legal-aid", "/lawyers", "/messages", "/bookmarks"];

function inSection(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, href: string) {
  if (href === HELP_HREF) return HELP_SECTIONS.some((section) => inSection(pathname, section));
  return inSection(pathname, href);
}

export function CitizenShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const errorText = useErrorText();
  const { user, ready, error, refresh } = useSession();

  // The proxy only sees a cookie. If the session behind it is gone, send the
  // person to sign in. Not when the session could not be checked: that is a bad
  // connection, and the person may well be signed in.
  useEffect(() => {
    if (ready && !user && !error) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, error, pathname, router]);

  return (
    <div className="min-h-screen bg-bg md:p-3">
      <div className="mx-auto flex min-h-screen max-w-[1280px] overflow-hidden bg-bg md:min-h-[calc(100vh-1.5rem)] md:rounded-[24px] md:border md:border-border md:bg-surface">
        <aside className="hidden w-[220px] shrink-0 flex-col bg-navy text-white md:flex">
          <div className="px-4 py-5">
            <BrandMark variant="light" />
          </div>
          <nav aria-label={t("label")} className="flex-1 space-y-1 px-3">
            {CITIZEN_NAV.map((item) => {
              const Icon = navIcons[item.href];
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[16px] font-medium",
                    active ? "bg-primary text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-2 p-3 pb-4">
            <LanguageSwitcher variant="light" />
            <Link
              href="/settings"
              className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-2.5 py-3 hover:bg-white/15"
            >
              <Avatar name={user?.displayName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">
                  {user?.displayName || common("you")}
                </span>
                <span className="block text-[13px] text-white/75">{common("myAccount")}</span>
              </span>
              <ChevronRight className="size-4 text-white/60" aria-hidden />
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-bg">
          <header className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 md:hidden">
            <BrandMark compact />
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <Link
                href="/settings"
                aria-label={common("myAccount")}
                className="inline-flex size-11 items-center justify-center rounded-full"
              >
                <Avatar name={user?.displayName} size="sm" />
              </Link>
            </div>
          </header>
          <main id="main" className="min-w-0 flex-1">
            {error ? (
              <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-8">
                <Alert tone="danger" title={common("couldNotLoad")}>
                  {errorText(error)}
                </Alert>
                <Button size="lg" className="w-full" onClick={() => void refresh()}>
                  {common("tryAgain")}
                </Button>
              </div>
            ) : (
              children
            )}
          </main>
          {/* Bottom padding keeps the line clear of the fixed phone navigation. */}
          <div className="border-t border-border bg-surface pb-16 md:pb-0">
            <DisclaimerBar compact />
          </div>
        </div>
      </div>

      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface md:hidden"
      >
        {CITIZEN_NAV.map((item) => {
          const Icon = navIcons[item.href];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 border-t-[3px] px-1 text-center text-[13px] font-semibold leading-tight",
                active ? "border-primary text-primary" : "border-transparent text-muted",
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} aria-hidden />
              {t(item.shortLabel)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
