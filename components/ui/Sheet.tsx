"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useTranslations } from "use-intl";
import { useEffect, useId, useRef } from "react";
import { IconButton } from "./Button";

/**
 * A panel over the page: from the bottom on a phone, centred on a wide screen.
 * Built on the browser's own dialog, which keeps focus inside the panel, makes
 * the page behind it inert, closes on Escape and returns focus to the button
 * that opened it.
 */
export function Sheet({
  open,
  onClose,
  title,
  locked = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** While something started from the panel is still running, it cannot be closed, so its result is always seen. */
  locked?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The page behind must not scroll while the panel is up.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape asks to close before it closes; this is where a locked panel says no.
      onCancel={(e) => {
        if (locked) e.preventDefault();
      }}
      // Fires for Escape and for close(); keeps the parent's state in step.
      onClose={onClose}
      // A click on the dimmed area lands on the dialog element itself.
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[88vh] w-full max-w-none flex-col rounded-t-2xl border border-border bg-surface p-0 text-ink shadow-lg backdrop:bg-navy/40 open:flex md:m-auto md:max-w-lg md:rounded-2xl",
      )}
    >
      {open ? (
        <>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id={titleId} className="text-[19px] font-semibold text-navy">
              {title}
            </h2>
            <IconButton label={t("close")} onClick={onClose} disabled={locked} className="size-11">
              <X className="size-6" aria-hidden />
            </IconButton>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
