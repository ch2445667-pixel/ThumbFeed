import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import { QueryProvider } from "@/lib/QueryProvider";
import { AppearanceProvider } from "@/lib/appearanceContext";
import { GlassBackdrop } from "@/components/GlassBackdrop";

const geistSans = Outfit({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ThumbFeed",
  description: "High-CTR YouTube and Pinterest thumbnail inspiration gallery with multi-image clipboard paste, bulk extraction, cloud auto-sync, and smart tagging.",
  openGraph: {
    title: "ThumbFeed",
    description: "High-CTR YouTube and Pinterest thumbnail inspiration gallery with multi-image clipboard paste, bulk extraction, cloud auto-sync, and smart tagging.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#040406" },
    { media: "(prefers-color-scheme: dark)", color: "#040406" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                document.documentElement.classList.add('dark');

                // Prevent benign 404/network image load events from bubbling to global window error listeners
                window.addEventListener('error', function(e) {
                  if (e && e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'LINK' || e.target.tagName === 'VIDEO')) {
                    if (typeof e.stopPropagation === 'function') e.stopPropagation();
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[#040406] text-white antialiased">
        <AuthProvider>
          <QueryProvider>
            <AppearanceProvider>
              <GlassBackdrop />
              <div className="relative z-10 min-h-screen">{children}</div>
            </AppearanceProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
