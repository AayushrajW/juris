import { AppPage, PageHeading } from "@/components/ui/AppKit";

export default function ResourcesPage() {
  return (
    <AppPage>
      <PageHeading
        title="Legal Resources"
        subtitle="Official starting points. These are not citations for your facts."
      />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[
          ["eCourts", "https://ecourts.gov.in/", "Find cause lists and case status on the official portal."],
          ["India Code", "https://www.indiacode.nic.in/", "Browse central Acts as published by the government."],
          ["NALSA", "https://nalsa.gov.in/", "Legal aid information for eligible citizens."],
          ["Consumer helpline", "https://consumerhelpline.gov.in/", "National consumer helpline starting point."],
        ].map(([title, href, body]) => (
          <a key={title} href={href} className="ns-card block p-5 hover:border-primary/25">
            <p className="text-[15px] font-semibold text-navy">{title}</p>
            <p className="mt-2 text-[13px] text-muted">{body}</p>
          </a>
        ))}
      </div>
    </AppPage>
  );
}
