import { AppPage, PageHeading } from "@/components/ui/AppKit";
import { APP_NAME } from "@/lib/constants";

export default function LegalAidPage() {
  return (
    <AppPage>
      <PageHeading
        title="Legal Aid & Authorities"
        subtitle="If you need a person today, start with official legal aid — not this demo."
      />
      <div className="mt-6 space-y-3">
        <a href="https://nalsa.gov.in/" className="ns-card block p-5 hover:border-primary/25">
          <p className="text-[15px] font-semibold text-navy">NALSA</p>
          <p className="mt-1 text-[13px] text-muted">National Legal Services Authority — legal aid information.</p>
        </a>
        <a href="https://ecourts.gov.in/" className="ns-card block p-5 hover:border-primary/25">
          <p className="text-[15px] font-semibold text-navy">eCourts</p>
          <p className="mt-1 text-[13px] text-muted">Court information and case status services.</p>
        </a>
        <div className="rounded-2xl bg-pastel-orange p-5">
          <p className="text-[14px] font-semibold text-navy">{APP_NAME} does not represent you</p>
          <p className="mt-1 text-[13px] text-ink/85">
            Sample advocate listings in this app are not a live directory. For emergencies, contact local police or legal aid.
          </p>
        </div>
      </div>
    </AppPage>
  );
}
