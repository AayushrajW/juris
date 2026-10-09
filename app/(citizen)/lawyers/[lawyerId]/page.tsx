"use client";

import { Avatar } from "@/components/brand/Avatar";
import { AppPage, Tabs } from "@/components/ui/AppKit";
import { Button } from "@/components/ui/Button";
import { Alert, Badge, Skeleton } from "@/components/ui/Display";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";
import type { LawyerProfile } from "@/domain/lawyer";
import { MATTER_LABELS } from "@/lib/constants";
import { formatInr } from "@/lib/format";
import { matchLawyer } from "@/lib/lawyerMatch";
import { lawyerRepository } from "@/services";
import { ArrowLeft, BadgeCheck, Bookmark, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { id: "about", label: "About" },
  { id: "areas", label: "Practice Areas" },
  { id: "experience", label: "Experience" },
  { id: "reviews", label: "Reviews" },
  { id: "availability", label: "Availability" },
];

export default function LawyerProfilePage() {
  const { lawyerId } = useParams<{ lawyerId: string }>();
  const router = useRouter();
  const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("about");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void lawyerRepository.getById(lawyerId).then((r) => {
      if (r.ok) setLawyer(r.data);
      else setError(r.message);
      setSaved(isBookmarked(lawyerId));
    });
  }, [lawyerId]);

  if (error) {
    return (
      <AppPage>
        <Alert tone="danger" title="Profile not found">
          {error}
        </Alert>
      </AppPage>
    );
  }

  if (!lawyer) {
    return (
      <AppPage>
        <Skeleton className="h-40 w-full" />
      </AppPage>
    );
  }

  const match = matchLawyer(lawyer, {});

  return (
    <AppPage>
      <Link href="/lawyers" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-navy">
        <ArrowLeft className="size-4" />
        Back to lawyers
      </Link>
      <div className="ns-card mt-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar name={lawyer.fullName} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold text-navy">{lawyer.fullName}</h1>
              {lawyer.verified ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-info">
                  <BadgeCheck className="size-4" />
                  Verified
                </span>
              ) : null}
              <Badge tone="demo">Demo profile</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {lawyer.practiceAreas.map((a) => MATTER_LABELS[a]).join(" · ")}
              {lawyer.yearsExperience ? ` · ${lawyer.yearsExperience} years` : ""}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
              <MapPin className="size-3.5" />
              {lawyer.city}, {lawyer.state}
            </p>
            <p className="mt-1 text-[12px] text-muted">{lawyer.languages.join(", ")}</p>
            {lawyer.rating != null ? (
              <p className="mt-2 flex items-center gap-1 text-[13px] font-medium text-navy">
                <Star className="size-3.5 fill-warning text-warning" />
                {lawyer.rating.toFixed(1)}
                <span className="font-normal text-muted">
                  {lawyer.reviewCount ? ` · ${lawyer.reviewCount} reviews` : ""}
                </span>
              </p>
            ) : null}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[22px] font-semibold text-navy">{formatInr(lawyer.consultationFeeInr)}</p>
            <p className="text-[11px] text-muted">Consultation fee</p>
            <p className="mt-1 text-[12px] text-success">{lawyer.availability ?? "On request"}</p>
            <p className="mt-2 text-[12px] font-semibold text-success">{match.score}% match</p>
          </div>
        </div>
      </div>

      <Tabs className="mt-5" items={TABS} value={tab} onChange={setTab} />

      <div className="mt-5 ns-card p-5">
        {tab === "about" ? (
          <>
            <p className="text-[14px] leading-relaxed text-ink/90">{lawyer.bio}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-pastel-blue px-4 py-3">
                <p className="text-[13px] font-semibold text-navy">{lawyer.casesHandledLabel ?? "Sample caseload"}</p>
              </div>
              <div className="rounded-2xl bg-pastel-green px-4 py-3">
                <p className="text-[13px] font-semibold text-navy">{lawyer.successRateLabel ?? "Sample metric only"}</p>
              </div>
              <div className="rounded-2xl bg-pastel-purple px-4 py-3">
                <p className="text-[13px] font-semibold text-navy">{lawyer.barMembership ?? lawyer.enrollmentDisplay}</p>
              </div>
            </div>
          </>
        ) : null}
        {tab === "areas" ? (
          <div className="flex flex-wrap gap-2">
            {lawyer.practiceAreas.map((a) => (
              <Badge key={a}>{MATTER_LABELS[a]}</Badge>
            ))}
          </div>
        ) : null}
        {tab === "experience" ? (
          <p className="text-sm text-ink/90">
            {lawyer.yearsExperience
              ? `This demo profile lists about ${lawyer.yearsExperience} years of sample experience in ${lawyer.city}.`
              : "Experience details are not listed on this demo profile."}
          </p>
        ) : null}
        {tab === "reviews" ? (
          <p className="text-sm text-muted">
            {lawyer.reviewCount
              ? `${lawyer.reviewCount} sample reviews are summarised as ${lawyer.rating?.toFixed(1)} stars. Individual reviews are not stored in this prototype.`
              : "Reviews are not available in this prototype."}
          </p>
        ) : null}
        {tab === "availability" ? (
          <p className="text-sm text-ink/90">{lawyer.availability ?? "Please request a consultation to discuss timing."}</p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => router.push(`/messages?lawyerId=${lawyer.id}`)}>Talk</Button>
        <Button
          variant="secondary"
          onClick={() => setSaved(toggleBookmark(lawyer.id))}
        >
          <Bookmark className="size-4" />
          {saved ? "Saved" : "Save Lawyer"}
        </Button>
      </div>
      <Alert tone="info" title="Consultations">
        {lawyer.consultationNote}
      </Alert>
    </AppPage>
  );
}
