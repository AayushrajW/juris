"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { Input } from "@/components/ui/Field";
import { useSession } from "@/hooks/useSession";
import { DEMO_AUTH_NOTE } from "@/lib/constants";
import { authService } from "@/services";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    await authService.signUp({ email, displayName: name, password: "demo" });
    await refresh();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-[22px] font-semibold text-navy">Create a demo account</h1>
      <p className="mt-2 text-sm text-demo">{DEMO_AUTH_NOTE}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          id="name"
          label="Your name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          hint="Stored only in this browser for the prototype."
          defaultValue=""
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving locally…" : "Enter the prototype"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-demo">
        Already have a demo session?{" "}
        <Link className="font-medium text-navy underline-offset-2 hover:underline" href="/sign-in">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
