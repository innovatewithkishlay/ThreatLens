/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05070a",
          900: "#080b10",
          850: "#0b0f15",
          800: "#0f141c",
          700: "#161d28",
          600: "#1f2836",
          500: "#2a3546",
        },
        accent: {
          DEFAULT: "#00ff9d",
          soft: "#5cffc0",
          dim: "#00c47a",
        },
        cyan: { glow: "#22d3ee" },
        sev: {
          critical: "#ff4d6d",
          high: "#ff8a3d",
          medium: "#facc15",
          low: "#38bdf8",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,255,157,0.25), 0 8px 40px -8px rgba(0,255,157,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "grid-pan": { from: { backgroundPosition: "0 0" }, to: { backgroundPosition: "56px 56px" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        "pulse-ring": { "0%": { transform: "scale(0.8)", opacity: "0.8" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
      },
      animation: {
        "grid-pan": "grid-pan 18s linear infinite",
        scan: "scan 3s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.2,0.6,0.4,1) infinite",
      },
    },
  },
  plugins: [],
};
