import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
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
        blue: "var(--blue)",
        green: "var(--green)",
        brand: { DEFAULT: "#185FA5", light: "#E6F1FB", dark: "#0C447C" },
        success: { DEFAULT: "#3B6D11", light: "#EAF3DE", dark: "#27500A" },
        warning: { DEFAULT: "#854F0B", light: "#FAEEDA", dark: "#633806" },
        danger: { DEFAULT: "#A32D2D", light: "#FCEBEB", dark: "#791F1F" },
        background: {
          DEFAULT: "#ffffff",
          dark: "#0f172a"
        },
        foreground: {
          DEFAULT: "#1f2937",
          dark: "#e2e8f0"
        },
        card: {
          DEFAULT: "#f9fafb",
          dark: "#1e293b"
        },
        "card-border": {
          DEFAULT: "#e5e7eb",
          dark: "#334155"
        },
        muted: {
          DEFAULT: "#6b7280",
          dark: "#94a3b8"
        },
        accent: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb"
        }
      },
      boxShadow: {
        glow: "0 0 30px rgba(59,130,246,0.35)",
        soft: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
