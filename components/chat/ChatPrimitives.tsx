"use client";

import { cn } from "@/lib/cn";
import { useTranslations } from "use-intl";
import { useId } from "react";

export function MessageBubble({
  align,
  tone = "plain",
  lang,
  children,
}: {
  align: "left" | "right";
  tone?: "plain" | "accent" | "ai";
  /** The language of the words inside, when it is known and may not be the page's. */
  lang?: string;
  children: React.ReactNode;
}) {
  const bubble =
    tone === "accent"
      ? "bg-primary text-white"
      : tone === "ai"
        ? "bg-pastel-orange text-ink"
        : "bg-white text-ink border border-border";
  return (
    <div className={cn("flex", align === "right" ? "justify-end" : "justify-start")}>
      <div lang={lang} className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[16px] leading-relaxed", bubble)}>
        {children}
      </div>
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("assistant");
  const common = useTranslations("common");
  const id = useId();
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t("inputLabel")}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        disabled={disabled}
        autoComplete="off"
        enterKeyHint="send"
        className="min-h-12 flex-1 rounded-[14px] border border-border bg-surface px-4 text-[16px] outline-none placeholder:text-muted focus:border-primary"
      />
      <button
        type="submit"
        aria-label={common("send")}
        disabled={disabled}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
          <path d="M3.4 20.6 21 12 3.4 3.4 3 10l12 2-12 2z" />
        </svg>
      </button>
    </form>
  );
}
