import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      /* ── Colors (HSL channel values from globals.css) ── */
      colors: {
        border:       "hsl(var(--border))",
        input:        "hsl(var(--input))",
        ring:         "hsl(var(--ring))",
        background:   "hsl(var(--background))",
        foreground:   "hsl(var(--foreground))",

        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          strong:     "hsl(var(--primary-strong))",
          soft:       "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft:       "hsl(var(--destructive-soft))",
        },
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft:       "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft:       "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT:    "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },

      /* ── Border Radius ── */
      borderRadius: {
        lg:  "calc(var(--radius) + 2px)",   /* 12px */
        md:  "var(--radius)",                /* 10px */
        sm:  "calc(var(--radius) - 2px)",    /* 8px  */
        xl:  "calc(var(--radius) + 6px)",    /* 16px */
        "2xl": "calc(var(--radius) + 10px)", /* 20px */
      },

      /* ── Typography ── */
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"],
      },

      /* ── Shadows (glass-optimized) ── */
      boxShadow: {
        card:   "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
        soft:   "0 2px 8px rgba(0,0,0,0.25), 0 0 1px rgba(255,255,255,0.05)",
        float:  "0 8px 30px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.06)",
        glow:   "0 0 28px hsl(263 70% 58% / 0.28)",
        "glow-accent": "0 0 28px hsl(25 95% 53% / 0.24)",
        glass:  "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
      },

      /* ── Backdrop Blur ── */
      backdropBlur: {
        xs:   "2px",
        "2xl": "40px",
        "3xl": "64px",
      },

      /* ── Keyframes (referenced in animation) ── */
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to:   { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in":  "fade-in 0.4s ease-out both",
        "slide-up": "slide-up 0.4s ease-out both",
        shimmer:    "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
