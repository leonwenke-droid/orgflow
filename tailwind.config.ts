import type { Config } from "tailwindcss";

/** Brand Blue ramp — docs/brand/orgflow_brand_guide.html */
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
      borderRadius: {
        "brand-tag": "4px",
        "brand-input": "8px",
        "brand-button": "10px",
        "brand-card": "12px",
        "brand-modal": "14px",
        "brand-pill": "24px",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Instrument Serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      colors: {
        "bg-app": "var(--bg-app)",
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",
        "bg-inverse": "var(--bg-inverse)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "text-disabled": "var(--text-disabled)",
        "text-inverse": "var(--text-inverse)",
        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        blue: brandBlue,
        green: "var(--green)",
        brand: { DEFAULT: "#185FA5", light: "#E6F1FB", dark: "#0C447C" },
        success: {
          DEFAULT: "#3B6D11",
          light: "#EAF3DE",
          mid: "#639922",
          dark: "#27500A",
        },
        warning: {
          DEFAULT: "#854F0B",
          light: "#FAEEDA",
          bright: "#EF9F27",
          dark: "#633806",
        },
        danger: {
          DEFAULT: "#A32D2D",
          light: "#FCEBEB",
          bright: "#E24B4A",
          dark: "#791F1F",
        },
        background: {
          DEFAULT: "var(--bg-app)",
          dark: "var(--bg-app)",
        },
        foreground: {
          DEFAULT: "var(--text-primary)",
          dark: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--bg-primary)",
          dark: "var(--bg-primary)",
        },
        "card-border": {
          DEFAULT: "var(--border-default)",
          dark: "var(--border-default)",
        },
        muted: {
          DEFAULT: "var(--text-muted)",
          dark: "var(--text-muted)",
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
