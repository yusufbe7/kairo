import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Kairo design tokens.
 * `brand` (ice periwinkle) is reserved for time & scheduling:
 * the "now" marker, scheduled states and the schedule action.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#060709",
        foreground: "#ECEDEF",
        panel: "#0B0C0F",
        card: { DEFAULT: "#0F1115", foreground: "#ECEDEF" },
        popover: { DEFAULT: "#111318", foreground: "#ECEDEF" },
        primary: { DEFAULT: "#ECEDEF", foreground: "#08090B" },
        secondary: { DEFAULT: "rgba(255,255,255,0.035)", foreground: "#ECEDEF" },
        accent: { DEFAULT: "rgba(255,255,255,0.05)", foreground: "#ECEDEF" },
        muted: { DEFAULT: "rgba(255,255,255,0.04)", foreground: "#9096A0" },
        dim: "#5E636C",
        brand: { DEFAULT: "#93ABFF", foreground: "#0B0F1C" },
        success: "#6EDCA0",
        warning: "#EDB866",
        destructive: { DEFAULT: "#F08A8A", foreground: "#08090B" },
        border: "rgba(255,255,255,0.065)",
        "border-strong": "rgba(255,255,255,0.12)",
        input: "rgba(255,255,255,0.065)",
        ring: "rgba(147,171,255,0.6)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { lg: "16px", md: "10px", sm: "8px" },
      keyframes: {
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        landed: { "0%": { transform: "scale(1.06)", boxShadow: "0 0 0 2px rgba(147,171,255,.5)" }, "100%": { transform: "none", boxShadow: "none" } },
      },
      animation: {
        shimmer: "shimmer 1.2s linear infinite",
        float: "float 6s ease-in-out infinite",
        landed: "landed .5s cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [animate],
};
export default config;
