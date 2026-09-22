import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        cream: "#E4E0D3",
        white: "#FFFFFF",
        espresso: "#401D1A",
        brand: {
          DEFAULT: "#401D1A",
          hover: "#401D1A",
          light: "#E4E0D3",
          dark: "#401D1A",
          border: "#E4E0D3",
          blue: {
            DEFAULT: "#401D1A",
            hover: "#401D1A",
            light: "#E4E0D3",
            dark: "#401D1A",
            border: "#E4E0D3",
          },
          orange: {
            DEFAULT: "#401D1A",
            hover: "#401D1A",
            light: "#E4E0D3",
            dark: "#401D1A",
            border: "#E4E0D3",
          },
          youtube: "#401D1A",
          pinterest: "#401D1A",
        },
        accent: {
          DEFAULT: "#401D1A",
          hover: "#401D1A",
          glow: "rgba(64, 29, 26, 0.25)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(64, 29, 26, 0.35)',
        'card': '0 1px 3px rgba(64, 29, 26, 0.05), 0 4px 12px rgba(64, 29, 26, 0.03), 0 0 0 0.5px rgba(64, 29, 26, 0.08)',
        'card-hover': '0 8px 24px -4px rgba(64, 29, 26, 0.15), 0 2px 6px -1px rgba(64, 29, 26, 0.05), 0 0 0 1px rgba(64, 29, 26, 0.3)',
      }
    },
  },
  plugins: [],
};
export default config;
