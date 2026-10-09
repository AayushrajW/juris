"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { useSession } from "@/hooks/useSession";
import { DEMO_AUTH_NOTE } from "@/lib/constants";
import { authService } from "@/services";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const { refresh } = useSession();
  const [email, setEmail] = useState("meera.demo@juris.example");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await authService.signIn({ email, password, displayName: "Meera Iyer" });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await refresh();
    router.push(next);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-[22px] font-semibold text-navy">Sign in</h1>
      <p className="mt-2 text-sm text-demo">{DEMO_AUTH_NOTE}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          hint="Accepted but not checked against a server."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Opening demo…" : "Continue"}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link className="font-medium text-navy underline-offset-2 hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-demo">
        New here?{" "}
        <Link className="font-medium text-navy underline-offset-2 hover:underline" href="/sign-up">
          Create a demo account
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
