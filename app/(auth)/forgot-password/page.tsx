"use client";

import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { authService } from "@/services";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await authService.requestPasswordReset(email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.data.message);
  }

  return (
    <Card>
      <h1 className="text-[22px] font-semibold text-navy">Reset password</h1>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <Alert tone="info" title="Demo only">
            {message}
          </Alert>
        ) : null}
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link className="font-medium text-navy underline-offset-2 hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
