import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - ThumbFeed",
  description: "The terms that govern use of ThumbFeed.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:py-20">
      <Link
        href="/"
        className="text-xs font-medium text-ink-faint transition-colors hover:text-ink"
      >
        Back to gallery
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-2 text-xs text-ink-faint">Last updated September 30, 2026</p>

      <Section title="Eligibility &amp; agreement">
        <p>
          ThumbFeed provides a gallery of thumbnail references, filtering and
          inspection tools, and personal collections for planning your own
          designs. You must be at least 18 years old to create an account or use
          this service. By accessing or using ThumbFeed, you agree to these
          terms and our{" "}
          <Link href="/privacy" className="underline hover:text-ink">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Content ownership">
        <p>
          Thumbnails displayed in the gallery belong to their original creators
          and are shown as references for study. Nothing here transfers any
          ownership or licence to reuse that artwork. Your own collections and
          saved boards remain yours.
        </p>
      </Section>

      <Section title="Acceptable use &amp; account termination">
        <p>
          Do not misuse the service: no automated scraping at abusive rates, no
          uploading unlawful or infringing material, and no attempting to access
          accounts, administrative endpoints, or data that are not yours.
          Accounts that violate these rules may be suspended or removed. You may
          also delete your own account and stored workspace data at any time
          from your profile settings.
        </p>
      </Section>

      <Section title="Availability, governing context &amp; contact">
        <p>
          The service is provided as is, without warranties of any kind. Features
          may change or be discontinued, and we are not liable for indirect loss
          arising from use of the service. These terms are governed by the
          applicable laws of Pakistan. Questions or takedown inquiries may be
          sent to{" "}
          <a
            href="mailto:canonwater2025@gmail.com"
            className="underline hover:text-ink"
          >
            canonwater2025@gmail.com
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
