import type { Config } from "tailwindcss";

/**
 * Colors resolve to CSS custom properties defined in globals.css and swapped by
 * the `data-theme` attribute on <html>. This keeps a single token system that
 * both themes (and, later, per-label theming) key off of.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        border: "var(--border)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        faint: "var(--text-faint)",
        accent: "var(--accent)",
        complete: "var(--complete)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
