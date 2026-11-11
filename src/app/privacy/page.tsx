import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - ThumbFeed",
  description: "How ThumbFeed collects, uses and protects your data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:py-20">
      <Link
        href="/"
        className="text-xs font-medium text-ink-faint transition-colors hover:text-ink"
      >
        Back to gallery
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-2 text-xs text-ink-faint">Last updated September 30, 2026</p>

      <Section title="What we collect">
        <p>
          If you sign in with Google, we receive your basic profile information:
          your name, email address and profile photo. If you save thumbnails or
          build collections, that content stays in your browser storage on this
          device. Display preferences such as theme, grid density and view mode
          are also kept in your browser only.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          Your data runs the service and nothing else: keeping you signed in,
          keeping your saved thumbnails on this device, and remembering your
          preferences. We do not sell personal data, we do not show third-party
          ads, and we do not build advertising profiles.
        </p>
      </Section>

      <Section title="Where it lives">
        <p>
          Authentication runs through Google and Firebase. Your uploads and
          their images stay on this device, inside your browser storage. No
          account data is sent to a third-party database.
        </p>
      </Section>

      <Section title="Your control">
        <p>
          Signing out ends your session immediately. Clearing your browser storage
          removes everything this app saved locally, uploads included.
        </p>
      </Section>
    </main>
  );
}
