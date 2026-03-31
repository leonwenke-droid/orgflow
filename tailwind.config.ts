import type { Config } from "tailwindcss";

/** Brand Blue ramp (OrgFlow brand guide) — replaces default Tailwind blue. */
const brandBlue = {
  50: "#E6F1FB",
  100: "#B5D4F4",
  200: "#85B7EB",
  300: "#6B9FDF",
  400: "#378ADD",
  500: "#2E7BC4",
  600: "#185FA5",
  700: "#0F5289",
  800: "#0C447C",
  900: "#042C53",
  950: "#021829",
  DEFAULT: "#185FA5",
} as const;

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        serif: ["Instrument Serif", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        blue: brandBlue,
        green: "var(--green)",
        brand: { DEFAULT: "#185FA5", light: "#E6F1FB", dark: "#0C447C" },
        success: { DEFAULT: "#3B6D11", light: "#EAF3DE", dark: "#27500A" },
        warning: { DEFAULT: "#854F0B", light: "#FAEEDA", dark: "#633806" },
        danger: { DEFAULT: "#A32D2D", light: "#FCEBEB", dark: "#791F1F" },
        background: {
          DEFAULT: "#ffffff",
          dark: "#111110",
        },
        foreground: {
          DEFAULT: "#0c0c0b",
          dark: "#f0efe9",
        },
        card: {
          DEFAULT: "#fafaf8",
          dark: "#222220",
        },
        "card-border": {
          DEFAULT: "#e8e7e3",
          dark: "#3d3d3a",
        },
        muted: {
          DEFAULT: "#888780",
          dark: "#6b6a64",
        },
        accent: {
          ...brandBlue,
          DEFAULT: "#185FA5",
        },
      },
      boxShadow: {
        glow: "0 0 30px rgba(24,95,165,0.35)",
        soft: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
