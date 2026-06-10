import tailwindAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border-light)",
        input: "var(--bg-input)",
        ring: "var(--border-focus)",
        background: "var(--bg-main)",
        foreground: "var(--text-main)",
        primary: {
          DEFAULT: "var(--color-sage)",
          foreground: "var(--bg-main)",
        },
        secondary: {
          DEFAULT: "var(--bg-panel)",
          foreground: "var(--text-main)",
        },
        destructive: {
          DEFAULT: "var(--color-clay)",
          foreground: "var(--text-main)",
        },
        muted: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--color-sand)",
          foreground: "var(--bg-main)",
        },
        popover: {
          DEFAULT: "var(--bg-panel)",
          foreground: "var(--text-main)",
        },
        card: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-main)",
          hover: "var(--bg-card-hover)",
        },
        // Direct theme accessors
        sage: {
          DEFAULT: "var(--color-sage)",
          hover: "var(--color-sage-hover)",
        },
        clay: {
          DEFAULT: "var(--color-clay)",
        },
        sand: {
          DEFAULT: "var(--color-sand)",
        },
        gold: {
          DEFAULT: "var(--color-gold)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        title: ["Outfit", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [tailwindAnimate],
}
