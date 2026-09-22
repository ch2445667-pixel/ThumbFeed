import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";

export const metadata: Metadata = {
  title: "ThumbFeed",
  description: "High-CTR YouTube and Pinterest thumbnail inspiration gallery with multi-image clipboard paste, bulk extraction, cloud auto-sync, and smart tagging.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  openGraph: {
    title: "ThumbFeed",
    description: "High-CTR YouTube and Pinterest thumbnail inspiration gallery with multi-image clipboard paste, bulk extraction, cloud auto-sync, and smart tagging.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
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
              })();
            `,
          }}
        />
      </head>
      <body className="bg-background text-[#401D1A] dark:text-[#FFFFFF] min-h-screen antialiased selection:bg-[#401D1A] selection:text-[#FFFFFF]">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

