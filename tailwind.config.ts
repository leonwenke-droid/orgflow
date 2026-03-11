import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#1f2937",
        card: "#f9fafb",
        accent: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb"
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2"
        }
      },
      boxShadow: {
        glow: "0 0 30px rgba(34,211,238,0.35)",
        soft: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
