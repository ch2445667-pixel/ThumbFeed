import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About - ThumbFeed",
  description: "What ThumbFeed is and how the thumbnail inspiration gallery works.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 sm:py-20">
      <Link
        href="/"
        className="text-xs font-medium text-ink-faint transition-colors hover:text-ink"
      >
        Back to gallery
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">About ThumbFeed</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        ThumbFeed is a thumbnail inspiration gallery built for YouTube creators and
        thumbnail designers. It collects high-performing thumbnails in one place so
        you can study what makes people click before designing your own.
      </p>

      <Section title="What you can do here">
        <p>
          Browse the gallery and filter by niche, visual style, colour palette,
          and channel metadata. Open any thumbnail to inspect it at full
          resolution, compare layouts, and organise visual hooks for upcoming
          uploads.
        </p>
      </Section>

      <Section title="Collections &amp; cloud sync">
        <p>
          Sign in with Google to save references into personal boards that sync
          automatically across your devices. Your boards and profile settings
          stay in sync without manual exports.
        </p>
      </Section>

      <Section title="For contributors">
        <p>
          Administrators can upload thumbnails directly, import high-resolution
          assets from YouTube channels or Pinterest boards, and store everything
          in Cloudflare R2 object storage. Every thumbnail shown here is a
          reference for study; the artwork itself belongs to its original
          creators.
        </p>
      </Section>
    </main>
  );
}
