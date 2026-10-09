"use client";

import { AppPage } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, Card, Skeleton } from "@/components/ui/Display";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { FileDropzone, Stepper, type LocalFile } from "@/components/ui/FileDropzone";
import { useSession } from "@/hooks/useSession";
import { APP_NAME, MATTER_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { clearNewCaseDraft, loadNewCaseDraft, saveNewCaseDraft } from "@/lib/drafts";
import type { CaseSource, MatterCategory } from "@/domain/case";
import { caseRepository } from "@/services";
import { Check, FileText, Layers, Mic } from "lucide-react";
import { useTranslations } from "use-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Mode = "document" | "description" | "both";

const MODES = [
  { value: "document", icon: FileText, label: "modeDocument", hint: "modeDocumentHint" },
  { value: "description", icon: Mic, label: "modeDescription", hint: "modeDescriptionHint" },
  { value: "both", icon: Layers, label: "modeBoth", hint: "modeBothHint" },
] as const;

const MIN_STORY_LENGTH = 20;

function parseMode(value: unknown): Mode | null {
  return value === "document" || value === "description" || value === "both" ? value : null;
}

function isCategory(value: unknown): value is MatterCategory {
  return MATTER_CATEGORIES.includes(value as MatterCategory);
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

const noSubscription = () => () => {};

export default function NewCasePage() {
  // The form starts from what was typed earlier in this tab, which only the
  // browser knows, so it is drawn in the browser and not on the server.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return (
    <Suspense>
      {inBrowser ? (
        <NewCaseForm />
      ) : (
        <AppPage className="max-w-2xl">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="mt-6 h-64 w-full" />
        </AppPage>
      )}
    </Suspense>
  );
}

function NewCaseForm() {
  const t = useTranslations("newCase");
  const common = useTranslations("common");
  const tMatter = useTranslations("matter");
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useSession();

  const [draft] = useState(loadNewCaseDraft);
  // A link such as /cases/new?mode=document skips the first question.
  const linkedMode = parseMode(search.get("mode"));
  const startMode = linkedMode ?? parseMode(draft.mode) ?? "both";
  // The file cannot be kept, so a draft that had reached the last step goes back one.
  const draftStep = parseMode(draft.mode) === startMode ? Math.min(Number(draft.step) || 0, 1) : 0;

  const [step, setStep] = useState(linkedMode ? Math.max(draftStep, 1) : draftStep);
  const [mode, setMode] = useState<Mode>(startMode);
  const [title, setTitle] = useState(text(draft.title));
  const [category, setCategory] = useState<MatterCategory>(isCategory(draft.category) ? draft.category : "tenancy");
  const [city, setCity] = useState(text(draft.city));
  const [stateName, setStateName] = useState(text(draft.stateName) || t("defaultState"));
  const [file, setFile] = useState<LocalFile | null>(null);
  const [narrative, setNarrative] = useState(text(draft.narrative));
  const [outcomeWanted, setOutcomeWanted] = useState(text(draft.outcomeWanted));
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    saveNewCaseDraft({ step, mode, title, category, city, stateName, narrative, outcomeWanted });
  }, [step, mode, title, category, city, stateName, narrative, outcomeWanted]);

  // After a step change, take keyboard and screen-reader users to the top of the new step.
  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const wantsPaper = mode !== "description";
  const wantsStory = mode !== "document";
  const source: CaseSource =
    mode === "both" ? "document_and_description" : mode === "document" ? "document" : "description";

  function goTo(next: number) {
    moved.current = true;
    setError(null);
    setStep(next);
  }

  function checkDetails() {
    if (!title.trim()) return setError(t("errTitle"));
    if (wantsPaper && !file) return setError(t("errFile"));
    if (wantsStory && narrative.trim().length < MIN_STORY_LENGTH) return setError(t("errStory"));
    goTo(2);
  }

  async function submit() {
    if (!ack) return setError(t("errAck"));
    if (!user) return setError(t("errSession"));
    setPending(true);
    setError(null);
    try {
      const result = await caseRepository.createDraft(user.id, {
        title,
        category,
        source,
        city: city.trim() || undefined,
        state: stateName.trim() || undefined,
        document: wantsPaper ? (file ?? undefined) : undefined,
        description: wantsStory
          ? { narrative, whatOutcomeWanted: outcomeWanted.trim() || undefined }
          : undefined,
      });
      if (!result.ok) {
        setPending(false);
        return setError(t("errSave"));
      }
      clearNewCaseDraft();
      router.push(`/cases/${result.data.id}/processing`);
    } catch {
      setPending(false);
      setError(t("errSave"));
    }
  }

  const errorLine = error ? (
    <p className="text-[15px] font-medium text-danger" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <AppPage className="max-w-2xl">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="scroll-mt-4 text-[26px] font-semibold tracking-tight text-navy outline-none"
      >
        {t("title")}
      </h1>
      <p className="mt-2 text-[16px] text-muted">{t("subtitle")}</p>
      <div className="mt-6">
        <Stepper steps={[t("step1"), t("step2"), t("step3")]} current={step} label={t("progress")} />
      </div>

      {step === 0 ? (
        <div className="mt-8">
          <fieldset>
            <legend className="text-[18px] font-semibold text-navy">{t("modeLegend")}</legend>
            <div className="mt-3 grid gap-3">
              {MODES.map((option) => {
                const selected = mode === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                      selected ? "border-primary bg-pastel-blue" : "border-border bg-surface",
                    )}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={option.value}
                      checked={selected}
                      onChange={() => setMode(option.value)}
                      className="sr-only"
                    />
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-navy">
                      <option.icon className="size-6" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold text-navy">{t(option.label)}</span>
                      <span className="mt-0.5 block text-[15px] text-muted">{t(option.hint)}</span>
                    </span>
                    {selected ? <Check className="size-6 shrink-0 text-primary" strokeWidth={2.5} aria-hidden /> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Button className="mt-5 w-full" size="lg" onClick={() => goTo(1)}>
            {common("continue")}
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-8 space-y-4">
          <Input
            id="title"
            label={t("titleLabel")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            required
          />
          <Select
            id="category"
            label={t("categoryLabel")}
            value={category}
            onChange={(e) => setCategory(e.target.value as MatterCategory)}
          >
            {MATTER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tMatter(c)}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="city"
              label={t("cityLabel")}
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              id="state"
              label={t("stateLabel")}
              autoComplete="address-level1"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
            />
          </div>
          {wantsPaper ? (
            <div>
              <p className="mb-2 text-sm font-medium text-ink">{t("documentLabel")}</p>
              <FileDropzone value={file} onChange={setFile} label={t("documentLabel")} />
            </div>
          ) : null}
          {wantsStory ? (
            <>
              <Textarea
                id="narrative"
                label={t("storyLabel")}
                hint={t("storyHint")}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                required
              />
              <Input
                id="want"
                label={t("outcomeLabel")}
                value={outcomeWanted}
                onChange={(e) => setOutcomeWanted(e.target.value)}
              />
            </>
          ) : null}
          {errorLine}
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" onClick={() => goTo(0)}>
              {common("back")}
            </Button>
            <Button size="lg" className="flex-1" onClick={checkDetails}>
              {t("check")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-8 space-y-4">
          <Card>
            <dl className="space-y-3 text-[16px]">
              <div>
                <dt className="text-[14px] text-muted">{t("reviewName")}</dt>
                <dd className="font-semibold text-navy">{title}</dd>
              </div>
              <div>
                <dt className="text-[14px] text-muted">{t("reviewAbout")}</dt>
                <dd className="text-ink">{tMatter(category)}</dd>
              </div>
              <div>
                <dt className="text-[14px] text-muted">{t("reviewStartedWith")}</dt>
                <dd className="text-ink">{t(`source_${source}`)}</dd>
              </div>
            </dl>
            {file && wantsPaper ? (
              <p className="mt-3 text-[15px] text-ink">{t("reviewFile", { name: file.fileName })}</p>
            ) : null}
          </Card>
          <Alert tone="warning" title={t("warnTitle", { app: APP_NAME })}>
            {t("warnBody")}
          </Alert>
          <Checkbox id="ack" label={t("ack")} checked={ack} onChange={(e) => setAck(e.target.checked)} />
          {errorLine}
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" onClick={() => goTo(1)}>
              {common("back")}
            </Button>
            <Button size="lg" className="flex-1" onClick={() => void submit()} disabled={pending}>
              {pending ? t("saving") : t("create")}
            </Button>
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}
