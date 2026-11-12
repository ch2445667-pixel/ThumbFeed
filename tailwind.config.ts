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
        // Semantic tokens. Prefer these over arbitrary hex values.
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          sunken: "var(--surface-sunken)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-2)",
          faint: "var(--ink-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          on: "var(--on-accent)",
          "on-dim": "var(--on-accent-dim)",
          "on-line": "var(--on-accent-line)",
          veil: "var(--accent-veil)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-2)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
          line: "var(--danger-line)",
          on: "var(--on-danger)",
        },
        stage: "var(--stage)",

        // Legacy alias. Previously pointed at an undefined --border var, so
        // every border-border usage resolved to nothing.
        border: "var(--line)",

        // Legacy aliases retained so existing utilities resolve unchanged.
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: "#E4E0D3",
        white: "#FFFFFF",
        espresso: "#401D1A",
        brand: "var(--brand)",
      },
      fontFamily: {
        sans: ["'Google Sans'", "'Product Sans'", "'Plus Jakarta Sans'", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        logo: ["'Cal Sans'", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      // Uniform 14px corner radius across the entire app
      borderRadius: {
        none: "0",
        sm: "14px",
        DEFAULT: "14px",
        md: "14px",
        lg: "14px",
        xl: "14px",
        "2xl": "14px",
        "3xl": "14px",
        full: "9999px",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        elevated: "var(--shadow-elevated)",
        dock: "var(--shadow-dock)",
        // Retained for Navbar.tsx, which is currently unimported.
        glow: "var(--shadow-elevated)",
      },
      transitionTimingFunction: {
        fluid: "var(--ease-fluid)",
        spring: "var(--ease-spring)",
      },
    },
  },
  plugins: [],
};

export default config;
