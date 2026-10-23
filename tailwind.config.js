/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#03060c",
        depth: "#070d18",
        hull: "#0b1424",
        seam: "#16283f",
        forge: {
          cyan: "#35e0ff",
          teal: "#19b8d4",
          gold: "#f2c14e",
          pearl: "#eaf6ff",
          dim: "#7d95b2",
          alert: "#ff5470",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(53, 224, 255, 0.18)",
        goldglow: "0 0 28px rgba(242, 193, 78, 0.22)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.65" },
          "50%": { opacity: "1" },
        },
        "drift-up": {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "drift-up": "drift-up 0.5s ease-out both",
        scan: "scan 9s linear infinite",
      },
    },
  },
  plugins: [],
};
