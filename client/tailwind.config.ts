import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        paper: "#f5f1e8",
        brass: "#C26B2C",
        ember: "#C26B2C",
        "ember-wash": "#F3E3CE",
        dusk: "#6E5B92",
        "dusk-wash": "#ECE7F2",
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
