/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Lora", "Georgia", "Cambria", "'Times New Roman'", "Times", "serif"],
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        midnight: {
          950: "#070a13",
          900: "#0b0f19",
          850: "#0f1524",
          800: "#131b2e",
          750: "#17223b",
          700: "#1c2a47",
          600: "#273b61",
          500: "#365184",
          400: "#5075b8",
          300: "#7b9cd6",
          200: "#a9c0e8",
          100: "#dbe5f7",
          50: "#f0f4fc",
        },
        scholar: {
          emerald: "#10b981",
          emeraldDark: "#059669",
          slate: "#94a3b8",
          charcoal: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
