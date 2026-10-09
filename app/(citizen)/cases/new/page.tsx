"use client";

import { AppPage } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, Card, Skeleton } from "@/components/ui/Display";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { FileDropzone, Stepper } from "@/components/ui/FileDropzone";
import { useErrorText } from "@/hooks/useErrorText";
import { APP_NAME, MATTER_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { clearNewCaseDraft, loadNewCaseDraft, saveNewCaseDraft } from "@/lib/drafts";
import { newId } from "@/lib/ids";
import { MAX_TITLE_LENGTH, MIN_STORY_LENGTH, type CaseSource, type MatterCategory } from "@/domain/case";
import type { ServiceError } from "@/domain/result";
import { analysisService, caseService, documentService } from "@/services";
import { Check, FileText, Layers, Mic } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Mode = "document" | "description" | "both";

const MODES = [
  { value: "document", icon: FileText, label: "modeDocument", hint: "modeDocumentHint" },
  { value: "description", icon: Mic, label: "modeDescription", hint: "modeDescriptionHint" },
  { value: "both", icon: Layers, label: "modeBoth", hint: "modeBothHint" },
] as const;

type FieldErrors = { title?: string; file?: string; story?: string };

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
  const tFile = useTranslations("file");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();

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
  const [file, setFile] = useState<File | null>(null);
  const [narrative, setNarrative] = useState(text(draft.narrative));
  const [outcomeWanted, setOutcomeWanted] = useState(text(draft.outcomeWanted));
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  // One id for what is being sent, so a second tap or a retry never makes a
  // second case. It is renewed whenever the person goes back to change something.
  const requestId = useRef<string>(newId());
  // The same for the paper: one id per chosen file.
  const paperRequest = useRef<{ file: File; id: string } | null>(null);
  // What a try that stopped half way has already made.
  const made = useRef<{ caseId: string; file?: File } | null>(null);
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

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function checkDetails() {
    const problems: FieldErrors = {};
    if (!title.trim()) problems.title = t("errTitle");
    if (wantsPaper && !file) problems.file = t("errFile");
    if (wantsStory && narrative.trim().length < MIN_STORY_LENGTH) problems.story = t("errStory");
    setFieldErrors(problems);
    setError(null);
    // Take the person to the first thing that needs fixing.
    const first = problems.title ? "title" : problems.file ? "paper" : problems.story ? "narrative" : null;
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    goTo(2);
  }

  /**
   * Whenever the person goes back to change something, a case that a stopped
   * try left behind is dropped and the next try starts afresh. Carrying on
   * with it would quietly keep the old name, story or paper.
   */
  function startAfresh() {
    if (made.current) void caseService.remove(made.current.caseId);
    made.current = null;
    paperRequest.current = null;
    requestId.current = newId();
  }

  function editDetails() {
    startAfresh();
    goTo(1);
  }

  function stop(problem: ServiceError) {
    setPending(false);
    // Something the person can put right goes back to the field it belongs to.
    const fixable = problem.code === "invalid" || problem.code === "too_large";
    const field = fixable ? problem.field : undefined;
    if (field === "title" || field === "story" || field === "file") {
      startAfresh();
      goTo(1);
      const paper = tFile(problem.reason === "file_size" ? "errSize" : "errType");
      setFieldErrors({ [field]: field === "title" ? t("errTitle") : field === "story" ? t("errStory") : paper });
      return;
    }
    setError(errorText(problem));
  }

  async function submit() {
    if (!ack) return setError(t("errAck"));
    setPending(true);
    setError(null);
    // Three steps. A try that stops part way is picked up from where it stopped.
    if (!made.current) {
      const created = await caseService.create(
        {
          title,
          category,
          source,
          city: city.trim() || undefined,
          state: stateName.trim() || undefined,
          story: wantsStory ? { narrative, whatOutcomeWanted: outcomeWanted.trim() || undefined } : undefined,
        },
        { requestId: requestId.current },
      );
      if (!created.ok) return stop(created.error);
      made.current = { caseId: created.data.id };
    }
    const { caseId } = made.current;
    if (wantsPaper && file && made.current.file !== file) {
      if (paperRequest.current?.file !== file) paperRequest.current = { file, id: newId() };
      const added = await documentService.upload(caseId, file, { requestId: paperRequest.current.id });
      if (!added.ok) return stop(added.error);
      made.current = { caseId, file };
    }
    // The reading carries on by itself from here, even if this page is closed.
    const job = await analysisService.start(caseId, { language: locale });
    if (!job.ok) return stop(job.error);
    clearNewCaseDraft();
    router.push(`/cases/${caseId}/processing`);
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
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError("title");
            }}
            placeholder={t("titlePlaceholder")}
            maxLength={MAX_TITLE_LENGTH}
            error={fieldErrors.title}
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
              <FileDropzone
                id="paper"
                value={file}
                onChange={(next) => {
                  setFile(next);
                  clearFieldError("file");
                }}
                label={t("documentLabel")}
                error={fieldErrors.file}
              />
            </div>
          ) : null}
          {wantsStory ? (
            <>
              <Textarea
                id="narrative"
                label={t("storyLabel")}
                hint={t("storyHint")}
                value={narrative}
                onChange={(e) => {
                  setNarrative(e.target.value);
                  clearFieldError("story");
                }}
                error={fieldErrors.story}
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
              <p className="mt-3 text-[15px] text-ink">{t("reviewFile", { name: file.name })}</p>
            ) : null}
          </Card>
          <Alert tone="warning" title={t("warnTitle", { app: APP_NAME })}>
            {t("warnBody")}
          </Alert>
          <Checkbox id="ack" label={t("ack")} checked={ack} onChange={(e) => setAck(e.target.checked)} />
          {errorLine}
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" onClick={editDetails} disabled={pending}>
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
