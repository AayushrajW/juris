"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
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
import { useTranslations } from "use-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";

/** In the demo the sample person's number is already filled in, so one tap opens it. */
const SAMPLE_NUMBER = showPhone(DEMO_USER.phone).replace("+91 ", "");

/**
 * Signing in: a mobile number, then the code sent to it. There is no separate
 * way to "join" and no password. The first time a number is used, the code
 * makes the account.
 */
function SignInForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const errorText = useErrorText();
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  const { refresh } = useSession();

  const [phone, setPhone] = useState(env.demoMode ? SAMPLE_NUMBER : "");
  // Set once a code has been sent. Its presence is what moves the form to the second step.
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Seconds until another code may be asked for.
  const [wait, setWait] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // After moving between the two steps, the keypad opens on the new step's one
  // field. Not when the page first opens: a screen reader should start at the top.
  useEffect(() => {
    if (moved.current) (challenge ? codeRef : phoneRef).current?.focus();
  }, [challenge]);

  function show(problem: ServiceError) {
    if (problem.code === "rate_limited" && problem.retryAfterSeconds) setWait(problem.retryAfterSeconds);
    if (problem.code === "invalid" && problem.field === "phone") return setFieldError(t("errPhone"));
    if (problem.reason === "wrong_code") return setFieldError(t("errCode"));
    if (problem.reason === "code_expired") return setFieldError(t("errCodeExpired"));
    setError(errorText(problem));
  }

  async function sendCode(to: string) {
    setPending(true);
    setError(null);
    setFieldError(null);
    const sent = await authService.requestCode(to);
    setPending(false);
    if (!sent.ok) return show(sent.error);
    moved.current = true;
    setChallenge(sent.data);
    setWait(sent.data.resendAfterSeconds);
    // No message arrives in the demo, so the code is typed in for the person.
    setCode(sent.data.demoCode ?? "");
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    const number = toIndianMobile(phone);
    if (!number) {
      setFieldError(t("errPhone"));
      phoneRef.current?.focus();
      return;
    }
    void sendCode(number);
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    if (cleanCode(code).length !== CODE_LENGTH) {
      setFieldError(t("errCode"));
      codeRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    setFieldError(null);
    const checked = await authService.verifyCode(challenge.challengeId, code);
    if (!checked.ok) {
      setPending(false);
      show(checked.error);
      codeRef.current?.focus();
      return;
    }
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
  }

  const errorLine = error ? (
    <p className="text-[15px] text-danger" role="alert">
      {error}
    </p>
  ) : null;

  if (!challenge) {
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
            className="min-h-14 text-[20px] tracking-wide"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setFieldError(null);
            }}
            error={fieldError ?? undefined}
            required
          />
          {errorLine}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? t("sending") : t("sendCode")}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-[24px] font-semibold text-navy">{t("codeTitle")}</h1>
      <p className="mt-2 text-[16px] text-ink">{t("codeSentTo", { phone: showPhone(challenge.phone) })}</p>
      {challenge.demoCode ? (
        <p className="mt-3 rounded-xl bg-pastel-orange px-3 py-2.5 text-[15px] text-ink">
          {t("demoCode", { code: challenge.demoCode })}
        </p>
      ) : null}
      <form className="mt-6 space-y-4" onSubmit={submitCode} noValidate>
        <Input
          ref={codeRef}
          id="code"
          label={t("codeLabel")}
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
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("checking") : common("continue")}
        </Button>
      </form>
      <div className="mt-5 flex flex-col gap-2">
        {wait > 0 ? (
          <p className="text-[15px] text-muted" aria-live="polite">
            {t("resendIn", { seconds: String(wait) })}
          </p>
        ) : (
          <Button variant="secondary" onClick={() => void sendCode(challenge.phone)} disabled={pending}>
            {t("resend")}
          </Button>
        )}
        <Button variant="ghost" onClick={changeNumber} disabled={pending}>
          {t("changeNumber")}
        </Button>
      </div>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
