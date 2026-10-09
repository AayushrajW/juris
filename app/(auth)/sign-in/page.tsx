"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { useSession } from "@/hooks/useSession";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/safeRedirect";
import { authService } from "@/services";
import { useTranslations } from "use-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function SignInForm() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNextPath(search.get("next"));
  const { refresh } = useSession();
  const [email, setEmail] = useState(env.demoMode ? "meera.demo@juris.example" : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await authService.signIn({ email });
    setPending(false);
    if (!result.ok) {
      setError(t("failed"));
      return;
    }
    await refresh();
    router.push(next);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-[24px] font-semibold text-navy">{t("signInTitle")}</h1>
      {env.demoMode ? <p className="mt-2 text-[15px] text-muted">{t("demoNote")}</p> : null}
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          id="email"
          label={t("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error ? (
          <p className="text-[15px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("opening") : common("continue")}
        </Button>
      </form>
      <p className="mt-5 text-[15px] text-muted">
        {t("newHere")}{" "}
        <Link
          className="font-semibold text-navy underline underline-offset-2"
          href={search.get("next") ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}
        >
          {t("createAccount")}
        </Link>
      </p>
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
