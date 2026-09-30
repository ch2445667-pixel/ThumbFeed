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
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      // Collapsed to the four-step scale. The codebase previously used
      // 6/8/10/12/15/16px and "full" simultaneously with no rule.
      borderRadius: {
        none: "0",
        sm: "var(--r-sm)",
        DEFAULT: "var(--r-md)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-lg)",
        "2xl": "var(--r-lg)",
        "3xl": "var(--r-xl)",
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
