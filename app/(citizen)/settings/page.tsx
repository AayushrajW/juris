"use client";

import { Avatar } from "@/components/brand/Avatar";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Display";
import { useSession } from "@/hooks/useSession";
import { authService } from "@/services";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MORE = [
  { href: "/messages", label: "Messages" },
  { href: "/documents", label: "My papers" },
  { href: "/legal-aid", label: "Free legal aid" },
  { href: "/resources", label: "Official websites" },
  { href: "/bookmarks", label: "Saved people" },
];

export default function SettingsPage() {
  const { user } = useSession();
  const router = useRouter();

  async function signOut() {
    await authService.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <AppPage>
      <PageHeading title="My account" subtitle="Your name in this demo." />
      <Card className="mt-6">
        <div className="flex items-center gap-3">
          <Avatar name={user?.displayName} size="lg" />
          <div>
            <p className="text-[18px] font-semibold text-navy">{user?.displayName}</p>
            <p className="text-[14px] text-muted">{user?.email}</p>
          </div>
        </div>
        <ul className="mt-6 space-y-2">
          {MORE.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block rounded-xl px-1 py-3 text-[16px] font-medium text-navy hover:bg-bg">
                {item.label} →
              </Link>
            </li>
          ))}
        </ul>
        <Button className="mt-4" variant="secondary" size="lg" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Card>
    </AppPage>
  );
}
