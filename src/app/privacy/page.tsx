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

      <Section title="Who can use ThumbFeed">
        <p>
          ThumbFeed is intended for creators and designers aged 18 and over. We do
          not knowingly collect personal information from anyone under 18 years
          of age.
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          You can browse the public gallery without signing in. If you sign in
          with Google, we receive your basic account identifiers from Firebase
          Authentication: your user ID, name, verified email address, and profile
          photo. If you create custom profile details, boards, or saved
          collections, that data is stored so your workspace syncs across your
          devices. Display preferences such as theme, grid density, and view mode
          remain in your browser&apos;s local storage.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          Your data is used strictly to operate ThumbFeed: authenticating your
          session, syncing your profile and saved boards, enforcing administrator
          access controls for uploads, and serving curated thumbnail assets. We
          do not sell personal data, show third-party ads, or share user lists
          with advertisers.
        </p>
      </Section>

      <Section title="Where it lives &amp; data transfers">
        <p>
          ThumbFeed operates from Pakistan and uses Google Firebase (Authentication
          and Firestore) and Cloudflare R2 object storage to host application data
          and media assets. Local browser preferences stay on your device unless
          you sign in to sync your profile or boards.
        </p>
      </Section>

      <Section title="Retention, self-serve deletion &amp; contact">
        <p>
          Signing out clears locally cached profile and board state from your
          browser immediately. Your synced profile and boards remain only while
          your account is active. You can permanently delete your account,
          profile metadata, and synced boards directly at any time from the Edit
          Profile menu in the sidebar (&ldquo;Delete Account &amp; Data&rdquo;).
          For privacy questions or manual deletion assistance, contact{" "}
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
