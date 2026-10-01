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
          Browse the gallery and filter by niche, visual style, colour and text
          hooks. Open any thumbnail to inspect it up close, copy its dominant
          colour codes, read the detected on-image text, and generate design
          prompts for your own tools.
        </p>
      </Section>

      <Section title="Collections">
        <p>
          Save references into personal collections to plan upcoming videos or to
          keep a swipe file of styles you want to try. Collections live in your
          browser and can be exported as JSON.
        </p>
      </Section>

      <Section title="For contributors">
        <p>
          A browser extension captures thumbnails while you browse YouTube, and an
          admin hub can tag new uploads automatically. Every thumbnail shown here
          is a reference for study. The artwork itself belongs to its original
          creators.
        </p>
      </Section>
    </main>
  );
}
