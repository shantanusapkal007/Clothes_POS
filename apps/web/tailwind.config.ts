import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: { 
    extend: {
      colors: {
        "error-container": "#fee2e2",
        "secondary-fixed": "#ccfbf1",
        "on-tertiary": "#ffffff",
        "on-background": "#0f172a",
        "outline-variant": "#e2e8f0",
        "primary-fixed-dim": "#c7d2fe",
        "surface": "#ffffff",
        "primary-fixed": "#e0e7ff",
        "primary-container": "#4f46e5",
        "surface-tint": "#6366f1",
        "surface-container-highest": "#cbd5e1",
        "surface-bright": "#ffffff",
        "on-primary-fixed-variant": "#3730a3",
        "surface-container-high": "#e2e8f0",
        "surface-variant": "#f1f5f9",
        "surface-container-low": "#f8fafc",
        "on-secondary-container": "#115e59",
        "on-primary-fixed": "#1e1b4b",
        "tertiary-container": "#fef3c7",
        "on-tertiary-container": "#78350f",
        "tertiary": "#d97706",
        "on-primary-container": "#e0e7ff",
        "error": "#ef4444",
        "inverse-primary": "#c7d2fe",
        "on-secondary-fixed-variant": "#115e59",
        "outline": "#cbd5e1",
        "inverse-on-surface": "#f8fafc",
        "secondary-fixed-dim": "#99f6e4",
        "secondary-container": "#ccfbf1",
        "on-secondary": "#ffffff",
        "on-surface-variant": "#475569",
        "on-error": "#ffffff",
        "tertiary-fixed-dim": "#fcd34d",
        "on-error-container": "#7f1d1d",
        "surface-dim": "#f1f5f9",
        "secondary": "#0d9488",
        "on-tertiary-fixed": "#451a03",
        "background": "#f8fafc",
        "tertiary-fixed": "#fef3c7",
        "on-tertiary-fixed-variant": "#92400e",
        "on-secondary-fixed": "#042f2e",
        "primary": "#6366f1",
        "on-surface": "#0f172a",
        "surface-container-lowest": "#ffffff",
        "on-primary": "#ffffff",
        "surface-container": "#f1f5f9",
        "inverse-surface": "#1e293b"
      },
      borderRadius: {
        "DEFAULT": "0.75rem",
        "lg": "0.875rem",
        "xl": "1.25rem",
        "full": "9999px"
      },
      fontFamily: {
        "headline": ["var(--font-noto-serif)", "serif"],
        "body": ["var(--font-inter)", "sans-serif"],
        "label": ["var(--font-inter)", "sans-serif"]
      }
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ],
};

export default config;
