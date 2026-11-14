import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import { QueryProvider } from "@/lib/QueryProvider";

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

// Brand wordmark face. Self-hosted display font, applied to the logo only.
const brandFont = localFont({
  src: "./fonts/Coconat-Regular.otf",
  variable: "--font-brand",
  display: "swap",
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
    { media: "(prefers-color-scheme: light)", color: "#E4E0D3" },
    { media: "(prefers-color-scheme: dark)", color: "#161110" },
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
      className={`${geistSans.variable} ${geistMono.variable} ${brandFont.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('thumbfeed_theme');
                  if (saved === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }

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
      <body className="bg-canvas text-ink antialiased">
        <AuthProvider><QueryProvider>{children}</QueryProvider></AuthProvider>
      </body>
    </html>
  );
}
