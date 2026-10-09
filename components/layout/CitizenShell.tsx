"use client";

import { Avatar } from "@/components/brand/Avatar";
import { BrandMark } from "@/components/brand/Logo";
import { DisclaimerBar } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import { CITIZEN_NAV, MOBILE_NAV } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Briefcase, ChevronRight, FolderOpen, Home, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navIcons = {
  "/dashboard": Home,
  "/cases": FolderOpen,
  "/assistant": MessageCircle,
  "/lawyers": Briefcase,
} as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/cases") return pathname.startsWith("/cases");
  if (href === "/assistant") return pathname.startsWith("/assistant") || pathname.startsWith("/messages");
  if (href === "/lawyers") return pathname.startsWith("/lawyers") || pathname.startsWith("/legal-aid");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CitizenShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <div className="min-h-screen bg-bg md:p-3">
      <div className="mx-auto flex min-h-screen max-w-[1280px] overflow-hidden bg-bg md:min-h-[calc(100vh-1.5rem)] md:rounded-[24px] md:border md:border-border md:bg-surface">
        <aside className="hidden w-[200px] shrink-0 flex-col bg-navy text-white md:flex">
          <div className="px-4 py-5">
            <BrandMark variant="light" />
          </div>
          <nav aria-label="App" className="flex-1 space-y-1 px-3">
            {CITIZEN_NAV.map((item) => {
              const Icon = navIcons[item.href];
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium",
                    active ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 pb-4">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-2.5 py-3 hover:bg-white/15"
            >
              <Avatar name={user?.displayName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{user?.displayName ?? "You"}</span>
                <span className="block text-[12px] text-white/60">My account</span>
              </span>
              <ChevronRight className="size-4 text-white/50" aria-hidden />
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-bg">
          <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
            <BrandMark compact />
            <Link href="/settings" aria-label="My account">
              <Avatar name={user?.displayName} size="sm" />
            </Link>
          </header>
          <main id="main" className="min-w-0 flex-1 pb-24 md:pb-0">
            {children}
          </main>
          <div className="hidden border-t border-border bg-surface md:block">
            <DisclaimerBar compact />
          </div>
        </div>
      </div>

      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface md:hidden"
      >
        {MOBILE_NAV.map((item) => {
          const Icon = navIcons[item.href];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold",
                active ? "text-primary" : "text-muted",
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
