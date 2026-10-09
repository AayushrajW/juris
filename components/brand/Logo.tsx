"use client";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Scale } from "lucide-react";
import { useTranslations } from "use-intl";
import Link from "next/link";

export function BrandMark({
  variant = "dark",
  compact = false,
  href = "/dashboard",
}: {
  variant?: "dark" | "light";
  compact?: boolean;
  href?: string;
}) {
  const t = useTranslations("common");
  const light = variant === "light";
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-xl border",
          light ? "border-white/25 bg-white/10 text-white" : "border-navy/10 bg-pastel-blue text-navy",
        )}
      >
        <Scale className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      {compact ? (
        <span className={cn("text-sm font-semibold", light ? "text-white" : "text-navy")}>{APP_NAME}</span>
      ) : (
        <span className="min-w-0">
          <span className={cn("block text-sm font-semibold leading-tight", light ? "text-white" : "text-navy")}>
            {APP_NAME}
          </span>
          <span className={cn("block text-[12px] leading-tight", light ? "text-white/60" : "text-muted")}>
            {t("tagline")}
          </span>
        </span>
      )}
    </Link>
  );
}
