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
        background: "#ffffff",
        surface: "#f8fafc",
        surfaceHover: "#f1f5f9",
        border: "#e2e8f0",
        brand: {
          blue: {
            DEFAULT: "#009FDF",
            hover: "#008bc4",
            light: "#e6f6fc",
            dark: "#0073a3",
            border: "#b3e7f9",
          },
          orange: {
            DEFAULT: "#f76d25",
            hover: "#df5c17",
            light: "#fef1eb",
            dark: "#c84c0f",
            border: "#fed2be",
          },
          youtube: "#ff0000",
          pinterest: "#e60023",
        },
        accent: {
          DEFAULT: "#009FDF",
          hover: "#008bc4",
          glow: "rgba(0, 159, 223, 0.25)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        'glow-blue': '0 0 25px -5px rgba(0, 159, 223, 0.35)',
        'glow-orange': '0 0 25px -5px rgba(247, 109, 37, 0.35)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03), 0 0 0 0.5px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 8px 24px -4px rgba(0, 159, 223, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 159, 223, 0.3)',
      }
    },
  },
  plugins: [],
};
export default config;
