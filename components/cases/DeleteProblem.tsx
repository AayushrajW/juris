"use client";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useErrorText } from "@/hooks/useErrorText";
import { cn } from "@/lib/cn";
import { caseService } from "@/services";
import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { useState } from "react";

/**
 * "Delete this problem", with a question before anything is removed. Shown
 * wherever a problem can end up, including one that was never read or whose
 * reading failed, so a person is never left with something they cannot remove.
 */
export function DeleteProblem({
  caseId,
  onDeleted,
  className,
}: {
  caseId: string;
  onDeleted: () => void;
  className?: string;
}) {
  const t = useTranslations("analysis");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const removed = await caseService.remove(caseId);
    if (removed.ok) {
      onDeleted();
      return;
    }
    setBusy(false);
    setError(errorText(removed.error));
  }

  return (
    <>
      <Button
        variant="ghost"
        className={cn("text-danger hover:bg-pastel-red", className)}
        onClick={() => {
          setError(null);
          setAsking(true);
        }}
      >
        <Trash2 className="size-5" strokeWidth={1.75} aria-hidden />
        {t("deleteProblem")}
      </Button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={t("deleteTitle")} locked={busy}>
        <p className="text-[16px] leading-relaxed text-ink">{t("deleteBody")}</p>
        {error ? (
          <p className="mt-3 text-[15px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" size="lg" onClick={() => void remove()} disabled={busy}>
            {t("deleteYes")}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setAsking(false)} disabled={busy}>
            {common("keep")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
