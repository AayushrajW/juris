"use client";

import { Button } from "@/components/ui/Button";
import { Card, Skeleton } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { DEMO_USER } from "@/data/mocks/user";
import type { ServiceError } from "@/domain/result";
import { useErrorText } from "@/hooks/useErrorText";
import { useSession } from "@/hooks/useSession";
import { env } from "@/lib/env";
import { CODE_LENGTH, cleanCode, showPhone, toIndianMobile } from "@/lib/phone";
import { safeNextPath } from "@/lib/safeRedirect";
import { authService } from "@/services";
import type { CodeChallenge } from "@/services/types";
import { useLocale, useTranslations } from "use-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

/** In the demo the sample person's number is already filled in, so one tap opens it. */
const SAMPLE_NUMBER = showPhone(DEMO_USER.phone).replace("+91 ", "");

/** Past this many seconds a countdown stops helping, and the screen just says "later". */
const LONGEST_COUNTDOWN = 120;

// ---- The code on its way, kept for this tab ----
//
// People leave the browser to read the message, and a phone short of memory
// reloads the page when they come back. So the challenge is kept for the tab:
// which number, which challenge, and until when. Never the code itself.

const WAITING_KEY = "juris-sign-in";

interface Waiting {
  challenge: CodeChallenge;
  /** When another code may be asked for, as a time on this phone's clock. */
  resendAt: number;
}

function loadWaiting(): Waiting | null {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(WAITING_KEY) ?? "null");
    const waiting = saved as Waiting | null;
    if (!waiting?.challenge?.challengeId || Date.parse(waiting.challenge.expiresAt) <= Date.now()) return null;
    return waiting;
  } catch {
    return null;
  }
}

function saveWaiting(waiting: Waiting | null) {
  try {
    if (!waiting) return window.sessionStorage.removeItem(WAITING_KEY);
    const challenge: CodeChallenge = { ...waiting.challenge };
    delete challenge.demoCode;
    window.sessionStorage.setItem(WAITING_KEY, JSON.stringify({ ...waiting, challenge }));
  } catch {
    // Storage blocked. Signing in still works; it just will not survive a reload.
  }
}

const noSubscription = () => () => {};

/**
 * Signing in: a mobile number, then the code sent to it. There is no separate
 * way to "join" and no password. The first time a number is used, the code
 * makes the account.
 */
function SignInForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  const { refresh } = useSession();
  const sentToId = useId();

  const [restored] = useState(loadWaiting);
  const [phone, setPhone] = useState(env.demoMode ? SAMPLE_NUMBER : "");
  // Set once a code has been sent. Its presence is what moves the form to the second step.
  const [challenge, setChallenge] = useState<CodeChallenge | null>(restored?.challenge ?? null);
  // The last code sent, kept when the person steps back, so asking again for the same number returns to it.
  const [kept, setKept] = useState<CodeChallenge | null>(restored?.challenge ?? null);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // When another code may be asked for, and for which number.
  const [resendAt, setResendAt] = useState<number | null>(restored?.resendAt ?? null);
  const [waitPhone, setWaitPhone] = useState<string | null>(restored?.challenge.phone ?? null);
  // The clock, moved on once a second while there is something to count down.
  const [now, setNow] = useState(() => Date.now());
  const [sentAgain, setSentAgain] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  // The code is only ever shown in the demo, whatever a service sends back.
  const demoCode = env.demoMode ? challenge?.demoCode : undefined;

  // Counted from the clock, not by subtracting one each second: a phone slows
  // or stops timers while the browser is in the background.
  const left = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return;
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [counting]);

  // After moving between the two steps, focus goes to the new step's one field
  // (or, when the demo has filled the code in, to the button). Not when the
  // page first opens: a screen reader should start at the top.
  useEffect(() => {
    if (!moved.current) return;
    if (!challenge) phoneRef.current?.focus();
    else if (demoCode) continueRef.current?.focus();
    else codeRef.current?.focus();
  }, [challenge, demoCode]);

  function waitFor(number: string, seconds: number) {
    setWaitPhone(number);
    setResendAt(Date.now() + seconds * 1000);
    setNow(Date.now());
  }

  function show(problem: ServiceError, number: string) {
    if (problem.code === "rate_limited" && problem.retryAfterSeconds) waitFor(number, problem.retryAfterSeconds);
    if (problem.code === "invalid" && problem.field === "phone") return setFieldError(t("errPhone"));
    if (problem.reason === "wrong_code") return setFieldError(t("errCode"));
    if (problem.reason === "code_expired") {
      // The error tells the person to ask for a new code, so the button must be
      // there, and the dead code must not be come back to.
      setResendAt(null);
      setKept(null);
      saveWaiting(null);
      return setFieldError(t("errCodeExpired"));
    }
    setError(errorText(problem));
  }

  async function sendCode(number: string, again: boolean) {
    setPending(true);
    setError(null);
    setFieldError(null);
    const sent = await authService.requestCode(number, { language: locale });
    setPending(false);
    if (!sent.ok) return show(sent.error, number);
    moved.current = true;
    setChallenge(sent.data);
    setKept(sent.data);
    setSentAgain(again);
    waitFor(number, sent.data.resendAfterSeconds);
    saveWaiting({ challenge: sent.data, resendAt: Date.now() + sent.data.resendAfterSeconds * 1000 });
    // No message arrives in the demo, so the code is typed in for the person.
    setCode(env.demoMode ? (sent.data.demoCode ?? "") : "");
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    const number = toIndianMobile(phone);
    if (!number) {
      setFieldError(t("errPhone"));
      phoneRef.current?.focus();
      return;
    }
    // Stepped back by mistake, same number, and the code is still good: go back to it.
    if (kept && kept.phone === number && Date.parse(kept.expiresAt) > Date.now()) {
      moved.current = true;
      setError(null);
      setFieldError(null);
      setChallenge(kept);
      return;
    }
    void sendCode(number, false);
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    const digits = cleanCode(code);
    if (digits.length !== CODE_LENGTH) {
      setFieldError(t("errCodeShort"));
      codeRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    setFieldError(null);
    const checked = await authService.verifyCode(challenge.challengeId, digits);
    if (!checked.ok) {
      setPending(false);
      show(checked.error, challenge.phone);
      codeRef.current?.focus();
      return;
    }
    saveWaiting(null);
    await refresh();
    router.push(next);
    router.refresh();
  }

  function changeNumber() {
    moved.current = true;
    setChallenge(null);
    setCode("");
    setError(null);
    setFieldError(null);
    setSentAgain(false);
  }

  const errorLine = error ? (
    <p className="text-[15px] text-danger" role="alert">
      {error}
    </p>
  ) : null;

  const waitLine =
    left > LONGEST_COUNTDOWN ? t("resendLater") : left > 0 ? t("resendIn", { seconds: String(left) }) : null;

  if (!challenge) {
    // The wait belongs to one number. Another number can be tried straight
    // away, and so can the same number while its last code is still good:
    // that goes back to the code step without sending anything.
    const number = toIndianMobile(phone);
    const codeStillGood = Boolean(kept && kept.phone === number && Date.parse(kept.expiresAt) > now);
    const waiting = counting && number === waitPhone && !codeStillGood;
    return (
      <Card>
        <h1 className="text-[24px] font-semibold text-navy">{t("signInTitle")}</h1>
        {env.demoMode ? <p className="mt-2 text-[15px] text-muted">{t("demoNote")}</p> : null}
        <form className="mt-6 space-y-4" onSubmit={submitPhone} noValidate>
          <Input
            ref={phoneRef}
            id="phone"
            label={t("phoneLabel")}
            hint={t("phoneHint")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            // The country code is shown, so nobody has to wonder whether to type it.
            before={<span className="text-[20px]">+91</span>}
            className="min-h-14 pl-14 text-[20px] tracking-wide"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setFieldError(null);
            }}
            error={fieldError ?? undefined}
            required
          />
          {errorLine}
          <Button type="submit" size="lg" className="w-full" disabled={pending || waiting}>
            {pending ? t("sending") : t("sendCode")}
          </Button>
          {waiting && waitLine ? <p className="text-[15px] text-muted">{waitLine}</p> : null}
        </form>
      </Card>
    );
  }

  const sentTo = showPhone(challenge.phone);

  return (
    <Card>
      <h1 className="text-[24px] font-semibold text-navy">{t("codeTitle")}</h1>
      <p id={sentToId} className="mt-2 text-[16px] text-ink" role={sentAgain ? "status" : undefined}>
        {t("codeSentTo", { phone: sentTo })}
      </p>
      {demoCode ? (
        <p className="mt-3 rounded-xl bg-pastel-orange px-3 py-2.5 text-[15px] text-ink">
          {t("demoCode", { code: demoCode })}
        </p>
      ) : null}
      <form className="mt-6 space-y-4" onSubmit={submitCode} noValidate>
        <Input
          ref={codeRef}
          id="code"
          label={t("codeLabel")}
          // Read out with the field: which number the code went to.
          describedBy={sentToId}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH + 2}
          className="min-h-14 text-center text-[24px] tracking-[0.3em]"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setFieldError(null);
          }}
          error={fieldError ?? undefined}
          required
        />
        {errorLine}
        <Button ref={continueRef} type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("checking") : common("continue")}
        </Button>
      </form>
      <div className="mt-5 flex flex-col gap-3">
        {/* Said once, when the wait is over. The countdown itself is not announced every second. */}
        <p className="sr-only" role="status">
          {counting ? "" : t("resendReady")}
        </p>
        {waitLine ? (
          <p className="text-[15px] text-muted">{waitLine}</p>
        ) : (
          <Button variant="secondary" onClick={() => void sendCode(challenge.phone, true)} disabled={pending}>
            {t("resend")}
          </Button>
        )}
        {/* The usual reason a code does not come is a wrong digit in the number. */}
        {sentAgain ? <p className="text-[15px] text-ink">{t("codeNotCome", { phone: sentTo })}</p> : null}
        <Button variant="ghost" onClick={changeNumber} disabled={pending}>
          {t("changeNumber")}
        </Button>
      </div>
    </Card>
  );
}

export default function SignInPage() {
  // The form starts from a code that may already be on its way, which only
  // the browser knows, so it is drawn in the browser and not on the server.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return (
    <Suspense>
      {inBrowser ? (
        <SignInForm />
      ) : (
        <Card>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-6 h-14 w-full" />
          <Skeleton className="mt-4 h-14 w-full" />
        </Card>
      )}
    </Suspense>
  );
}
