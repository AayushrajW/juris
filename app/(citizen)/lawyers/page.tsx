"use client";

import { LawyerCard } from "@/components/lawyers/LawyerCard";
import { AppPage, FilterButton, PageHeading } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Display";
import { Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { MatterCategory } from "@/domain/case";
import type { LawyerProfile } from "@/domain/lawyer";
import { MATTER_LABELS } from "@/lib/constants";
import { sortLawyersByMatch } from "@/lib/lawyerMatch";
import { caseRepository, lawyerRepository } from "@/services";
import { useSession } from "@/hooks/useSession";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function LawyersInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useSession();
  const [lawyers, setLawyers] = useState<LawyerProfile[] | null>(null);
  const [city, setCity] = useState("all");
  const [area, setArea] = useState<MatterCategory | "all">("all");
  const [language, setLanguage] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ctx, setCtx] = useState<{ category?: MatterCategory; city?: string; state?: string }>({});

  useEffect(() => {
    void lawyerRepository.list().then((r) => {
      if (r.ok) setLawyers(r.data);
    });
  }, []);

  useEffect(() => {
    const caseId = search.get("caseId");
    if (!caseId || !user) return;
    void caseRepository.getById(caseId).then((r) => {
      if (r.ok) {
        setCtx({
          category: r.data.category,
          city: r.data.location?.city,
          state: r.data.location?.state,
        });
        setArea(r.data.category);
      }
    });
  }, [search, user]);

  const cities = useMemo(() => [...new Set((lawyers ?? []).map((l) => l.city))], [lawyers]);
  const languages = useMemo(
    () => [...new Set((lawyers ?? []).flatMap((l) => l.languages))].sort(),
    [lawyers],
  );

  const filtered = (lawyers ?? []).filter((l) => {
    if (city !== "all" && l.city !== city) return false;
    if (area !== "all" && !l.practiceAreas.includes(area)) return false;
    if (language !== "all" && !l.languages.includes(language)) return false;
    return true;
  });

  const ranked = sortLawyersByMatch(filtered, {
    category: ctx.category ?? (area === "all" ? undefined : area),
    city: ctx.city ?? (city === "all" ? undefined : city),
    state: ctx.state,
  });

  const activeCount = [city, area, language].filter((v) => v !== "all").length;

  return (
    <AppPage>
      <PageHeading
        title="Find a person to talk to"
        subtitle="Sample names so you can try the app. This is not a live lawyer list."
        actions={<FilterButton activeCount={activeCount} onClick={() => setFiltersOpen(true)} />}
      />
      <div className="mt-6 grid gap-3">
        {lawyers === null ? <Skeleton className="h-40" /> : null}
        {lawyers && ranked.length === 0 ? (
          <EmptyState title="No sample profiles match" body="Clear a filter to see demo advocates again." />
        ) : null}
        {ranked.map(({ lawyer, match }) => (
          <LawyerCard
            key={lawyer.id}
            lawyer={lawyer}
            match={match}
            onConsult={() => router.push(`/messages?lawyerId=${lawyer.id}`)}
          />
        ))}
      </div>
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter">
        <div className="space-y-4">
          <Select id="city" label="City" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="all">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            id="area"
            label="Practice area"
            value={area}
            onChange={(e) => setArea(e.target.value as MatterCategory | "all")}
          >
            <option value="all">All areas</option>
            {Object.entries(MATTER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select id="lang" label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="all">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Button className="w-full" onClick={() => setFiltersOpen(false)}>
            Apply
          </Button>
        </div>
      </Sheet>
    </AppPage>
  );
}

export default function LawyersPage() {
  return (
    <Suspense>
      <LawyersInner />
    </Suspense>
  );
}
