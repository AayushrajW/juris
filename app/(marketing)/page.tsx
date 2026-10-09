"use client";

import { LanguageChoices } from "@/components/i18n/LanguageSwitcher";
import { APP_NAME } from "@/lib/constants";
import { FileSearch, ListChecks, MessageCircle, Shield } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";

export default function LandingPage() {
  const t = useTranslations("landing");
  const common = useTranslations("common");
  const app = { app: APP_NAME };

  const path = [t("path1"), t("path2"), t("path3"), t("path4")];
  const how = [
    { icon: FileSearch, title: t("how1Title"), body: t("how1Body") },
    { icon: ListChecks, title: t("how2Title"), body: t("how2Body") },
    { icon: MessageCircle, title: t("how3Title"), body: t("how3Body") },
    { icon: Shield, title: t("how4Title"), body: t("how4Body") },
  ];

  return (
    <main id="main">
      {/* Language first: a person must be able to find their own script before anything else. */}
      <section className="border-b border-border bg-pastel-blue">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <p className="mb-2 text-[15px] font-semibold text-navy">{common("chooseLanguage")}</p>
          <LanguageChoices className="max-w-2xl" />
        </div>
      </section>

      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:py-16">
          <div>
            <p className="text-[15px] font-semibold text-info">{t("kicker")}</p>
            <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-navy md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink/85">{t("lead", app)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex min-h-14 items-center rounded-xl bg-primary px-8 text-[18px] font-semibold text-white hover:bg-primary-hover"
              >
                {t("start")}
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex min-h-14 items-center rounded-xl border border-border px-6 text-[17px] font-semibold text-navy"
              >
                {t("signIn")}
              </Link>
            </div>
            <p className="mt-4 text-[15px] text-muted">{t("note")}</p>
          </div>
          <div className="ns-card p-6">
            <h2 className="text-[17px] font-semibold text-navy">{t("pathTitle")}</h2>
            <ol className="mt-4 space-y-4">
              {path.map((item, i) => (
                <li key={i} className="flex gap-3 text-[16px] text-ink">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[15px] font-semibold text-white">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-semibold text-navy">{t("howTitle")}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {how.map((item, i) => (
            <article key={i} className="rounded-2xl border border-border bg-surface p-5">
              <item.icon className="size-7 text-navy" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-3 text-[17px] font-semibold text-navy">{item.title}</h3>
              <p className="mt-2 text-[15px] text-ink/85">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-3xl font-semibold text-navy">{t("trustTitle")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-[17px] font-semibold text-navy">{t("isTitle", app)}</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] text-ink/85">
                <li>{t("is1")}</li>
                <li>{t("is2")}</li>
                <li>{t("is3")}</li>
              </ul>
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-navy">{t("isNotTitle", app)}</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] text-ink/85">
                <li>{t("isNot1")}</li>
                <li>{t("isNot2")}</li>
                <li>{t("isNot3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-semibold text-navy">{t("forTitle")}</h2>
        <p className="mt-3 max-w-2xl text-[17px] text-ink/85">{t("forBody")}</p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex min-h-14 items-center rounded-xl bg-navy px-8 text-[17px] font-semibold text-white"
        >
          {t("openDemo")}
        </Link>
      </section>
    </main>
  );
}
