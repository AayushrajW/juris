import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Display";
import type { LawyerProfile } from "@/domain/lawyer";
import type { LawyerMatch } from "@/lib/lawyerMatch";
import { MATTER_LABELS } from "@/lib/constants";
import { formatInr } from "@/lib/format";
import { Check, MapPin, Star } from "lucide-react";
import Link from "next/link";

export function MatchScore({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-pastel-green px-2.5 py-0.5 text-[12px] font-semibold text-success">
      {score}% Match
    </span>
  );
}

export function LawyerCard({
  lawyer,
  match,
  onConsult,
}: {
  lawyer: LawyerProfile;
  match: LawyerMatch;
  onConsult: () => void;
}) {
  const areas = lawyer.practiceAreas.map((a) => MATTER_LABELS[a]).join(" · ");
  return (
    <article className="ns-card p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <Avatar name={lawyer.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold text-navy">{lawyer.fullName}</h2>
            {lawyer.verified ? <Badge tone="info">Verified</Badge> : null}
            <Badge tone="demo">Demo</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {areas}
            {lawyer.yearsExperience ? ` · ${lawyer.yearsExperience} years` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
            <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
            {lawyer.city}, {lawyer.state}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">{lawyer.languages.join(", ")}</p>
          {lawyer.rating != null ? (
            <p className="mt-2 flex items-center gap-1 text-[13px] font-medium text-navy">
              <Star className="size-3.5 fill-warning text-warning" aria-hidden />
              {lawyer.rating.toFixed(1)}
              <span className="font-normal text-muted">
                {lawyer.reviewCount ? ` · ${lawyer.reviewCount} reviews` : ""}
              </span>
            </p>
          ) : null}
        </div>
        <div className="w-full shrink-0 md:w-64">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[18px] font-semibold text-navy">{formatInr(lawyer.consultationFeeInr)}</p>
              <p className="text-[11px] text-muted">Talk fee</p>
              <p className="mt-1 text-[12px] text-success">{lawyer.availability ?? "Availability on request"}</p>
            </div>
            <MatchScore score={match.score} />
          </div>
          <p className="mt-3 text-[12px] font-semibold text-navy">Why this person?</p>
          <ul className="mt-1.5 space-y-1">
            {match.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-[12px] text-muted">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2} aria-hidden />
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/lawyers/${lawyer.id}`}>
              <Button variant="secondary" size="sm">
                See
              </Button>
            </Link>
            <Button size="sm" onClick={onConsult}>
              Talk
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
