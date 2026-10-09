"use client";

import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const palettes = [
  "bg-pastel-blue text-info",
  "bg-pastel-green text-success",
  "bg-pastel-purple text-primary",
  "bg-pastel-orange text-warning",
];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dim =
    size === "sm" ? "size-8 text-[10px]" : size === "lg" ? "size-16 text-lg" : size === "xl" ? "size-20 text-xl" : "size-11 text-xs";
  const hash = (name ?? "U").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dim,
        palettes[hash % palettes.length],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
