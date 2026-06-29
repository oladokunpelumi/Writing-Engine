import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#f8fafc",
        brass: "#b7791f",
        tide: "#0e7490"
      },
      fontFamily: {
        display: ["Syne", "Inter", "ui-sans-serif", "system-ui"],
        body: ["DM Sans", "Inter", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
} satisfies Config;
