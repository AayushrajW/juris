"use client";

import { Avatar } from "@/components/brand/Avatar";
import { LanguageChoices } from "@/components/i18n/LanguageSwitcher";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { Sheet } from "@/components/ui/Sheet";
import { useErrorText } from "@/hooks/useErrorText";
import { useSession } from "@/hooks/useSession";
import { APP_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import { accountService, authService } from "@/services";
import { ChevronRight, Download, FileText, LifeBuoy, LogOut, Trash2, type LucideIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useState } from "react";

/** Back to the first page with a full reload, which drops everything still held in memory. */
function leave() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/");
}

function saveAsFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // The browser needs the address for a moment after the click to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    leave();
  }

  async function downloadData() {
    setBusy(true);
    setError(null);
    const result = await accountService.exportData();
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    // The day on the person's own calendar, written year-month-day so files sort in order.
    const day = new Date(result.data.exportedAt).toLocaleDateString("en-CA");
    saveAsFile(`${APP_NAME.toLowerCase()}-my-data-${day}.json`, JSON.stringify(result.data, null, 2));
  }

  async function deleteEverything() {
    setBusy(true);
    setError(null);
    const result = await accountService.deleteAccount();
    if (!result.ok) {
      setBusy(false);
      setError(errorText(result.error));
      return;
    }
    leave();
  }

  const errorLine = error ? (
    <p className="mt-3 text-[15px] text-danger" role="alert">
      {error}
    </p>
  ) : null;

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

      <section className="mt-8">
        <h2 className="text-[17px] font-semibold text-navy">{t("yourData")}</h2>
        <Button
          className="mt-3 w-full"
          variant="secondary"
          size="lg"
          onClick={() => void downloadData()}
          disabled={busy}
        >
          <Download className="size-5" strokeWidth={1.75} aria-hidden />
          {t("downloadData")}
        </Button>
        <p className="mt-2 text-[14px] text-muted">{t("downloadNote")}</p>
        {confirmDelete ? null : errorLine}
        <Button
          className="mt-4 w-full text-danger hover:bg-pastel-red"
          variant="ghost"
          size="lg"
          onClick={() => {
            setError(null);
            setConfirmDelete(true);
          }}
          disabled={busy}
        >
          <Trash2 className="size-5" strokeWidth={1.75} aria-hidden />
          {t("deleteAll")}
        </Button>
      </section>

      <Button className="mt-8 w-full" variant="secondary" size="lg" onClick={() => void signOut()}>
        <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
        {t("signOut")}
      </Button>
      <p className="mt-2 text-center text-[14px] text-muted">{t("signOutNote")}</p>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("deleteAllTitle")} locked={busy}>
        <p className="text-[16px] leading-relaxed text-ink">{t("deleteAllBody")}</p>
        {errorLine}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" size="lg" onClick={() => void deleteEverything()} disabled={busy}>
            {t("deleteAllYes")}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setConfirmDelete(false)} disabled={busy}>
            {common("keep")}
          </Button>
        </div>
      </Sheet>
    </AppPage>
  );
}
