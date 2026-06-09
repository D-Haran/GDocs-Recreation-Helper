import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        "surface-raised": "var(--surface-raised)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        muted: "var(--muted)",
        "muted-strong": "var(--muted-strong)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        "accent-border": "var(--accent-border)",
        focus: "var(--ring)",
      },
    },
  },
  plugins: [],
};
export default config;
