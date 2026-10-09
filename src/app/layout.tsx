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
  // Icons are declared by the file convention (src/app/icon.png, icon.svg,
  // apple-icon.png, favicon.ico). Do not also list them here, and do not keep
  // copies in public/ -- either one re-introduces the route that collides with
  // the convention route and every icon request 500s.
  openGraph: {
    title: "ThumbFeed",
    description: "High-CTR YouTube and Pinterest thumbnail inspiration gallery with multi-image clipboard paste, bulk extraction, cloud auto-sync, and smart tagging.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E6E8EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e10" },
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
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

                // Inject saved colour overrides before first paint so a custom
                // palette does not flash the default token colours. Must run
                // AFTER the dark class is set, since the overrides are scoped
                // to :root and .dark.
                (function() {
                  try {
                    var raw = localStorage.getItem('thumbfeed_theme_overrides');
                    if (!raw) return;
                    var parsed = JSON.parse(raw);
                    if (!parsed || typeof parsed !== 'object') return;
                    var KEYS = ['canvas','surface','surface-raised','surface-sunken','ink','ink-2','ink-3','accent','accent-hover','on-accent','line','line-2','focus','danger','danger-soft','danger-line','on-danger','stage'];
                    var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
                    function clean(mode) {
                      var out = '';
                      var m = parsed[mode];
                      if (!m || typeof m !== 'object') return out;
                      for (var i = 0; i < KEYS.length; i++) {
                        var v = m[KEYS[i]];
                        if (typeof v === 'string' && HEX.test(v.trim())) {
                          out += '--' + KEYS[i] + ':' + v.trim() + ';';
                        }
                      }
                      return out;
                    }
                    var light = clean('light');
                    var dark = clean('dark');
                    if (!light && !dark) return;
                    var css = '';
                    if (light) css += ':root{' + light + '}';
                    if (dark) css += '.dark{' + dark + '}';
                    var el = document.createElement('style');
                    el.id = 'theme-overrides';
                    el.textContent = css;
                    document.head.appendChild(el);
                  } catch (e) {}
                })();

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
