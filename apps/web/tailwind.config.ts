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
        "error-container": "#fee4e2",
        "secondary-fixed": "#ccfbf1",
        "on-tertiary": "#ffffff",
        "on-background": "#1f1a1b",
        "outline-variant": "#dac8c6",
        "primary-fixed-dim": "#fecdd3",
        "surface": "#fafafa",
        "primary-fixed": "#ffe4e6",
        "primary-container": "#be123c",
        "surface-tint": "#9f1239",
        "surface-container-highest": "#efe4e2",
        "surface-bright": "#ffffff",
        "on-primary-fixed-variant": "#881337",
        "surface-container-high": "#f5ecea",
        "surface-variant": "#f2e7e5",
        "surface-container-low": "#f8f1ef",
        "on-secondary-container": "#625453",
        "on-primary-fixed": "#4c0519",
        "tertiary-container": "#fef3c7",
        "on-tertiary-container": "#78350f",
        "tertiary": "#d97706",
        "on-primary-container": "#fff1f2",
        "error": "#b42318",
        "inverse-primary": "#fecdd3",
        "on-secondary-fixed-variant": "#115e59",
        "outline": "#9b8584",
        "inverse-on-surface": "#fff7f7",
        "secondary-fixed-dim": "#99f6e4",
        "secondary-container": "#ccfbf1",
        "on-secondary": "#ffffff",
        "on-surface-variant": "#504546",
        "on-error": "#ffffff",
        "tertiary-fixed-dim": "#fcd34d",
        "on-error-container": "#7a271a",
        "surface-dim": "#eee7e5",
        "secondary": "#0f766e",
        "on-tertiary-fixed": "#451a03",
        "background": "#fafafa",
        "tertiary-fixed": "#fef3c7",
        "on-tertiary-fixed-variant": "#92400e",
        "on-secondary-fixed": "#042f2e",
        "primary": "#9f1239",
        "on-surface": "#1f1a1b",
        "surface-container-lowest": "#ffffff",
        "on-primary": "#ffffff",
        "surface-container": "#f7efed",
        "inverse-surface": "#362f30"
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
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
