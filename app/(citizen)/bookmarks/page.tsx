"use client";

import { LawyerCard } from "@/components/lawyers/LawyerCard";
import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { EmptyState } from "@/components/ui/Display";
import { listBookmarks } from "@/lib/bookmarks";
import { matchLawyer } from "@/lib/lawyerMatch";
import { lawyerRepository } from "@/services";
import type { LawyerProfile } from "@/domain/lawyer";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BookmarksPage() {
  const router = useRouter();
  const [lawyers, setLawyers] = useState<LawyerProfile[]>([]);

  useEffect(() => {
    const ids = listBookmarks();
    void lawyerRepository.list().then((r) => {
      if (r.ok) setLawyers(r.data.filter((l) => ids.includes(l.id)));
    });
  }, []);

  return (
    <AppPage>
      <PageHeading title="Bookmarks" subtitle="Saved demo lawyer profiles on this device." />
      <div className="mt-6 grid gap-3">
        {lawyers.length === 0 ? (
          <EmptyState title="Nothing saved yet" body="Open a lawyer profile and tap Save Lawyer." />
        ) : null}
        {lawyers.map((lawyer) => (
          <LawyerCard
            key={lawyer.id}
            lawyer={lawyer}
            match={matchLawyer(lawyer, {})}
            onConsult={() => router.push(`/messages?lawyerId=${lawyer.id}`)}
          />
        ))}
      </div>
    </AppPage>
  );
}
