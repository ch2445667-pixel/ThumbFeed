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

      <Section title="The service">
        <p>
          ThumbFeed provides a gallery of thumbnail references, filtering and
          inspection tools, and personal collections for planning your own
          designs. By using the service you agree to these terms.
        </p>
      </Section>

      <Section title="Content ownership">
        <p>
          Thumbnails displayed in the gallery belong to their original creators
          and are shown as references for study. Nothing here transfers any
          ownership or licence to reuse that artwork. Your own collections and
          uploads remain yours.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Do not misuse the service: no scraping at abusive rates, no uploading
          unlawful or infringing material, and no attempting to access accounts
          or data that are not yours. Accounts that violate these rules may be
          restricted or removed.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          The service is provided as is, without warranties of any kind. Features
          may change or be discontinued, and we are not liable for any loss
          arising from use of the service. Continued use after changes to these
          terms means you accept the updated terms.
        </p>
      </Section>
    </main>
  );
}
