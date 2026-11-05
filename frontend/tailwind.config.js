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
          950: "#101719",
          900: "#141d20",
          850: "#1a2529",
          800: "#212f33",
          750: "#26383c",
          700: "#324449",
          600: "#40575d",
          500: "#365184",
          400: "#5075b8",
          300: "#7b9cd6",
          200: "#a9c0e8",
          100: "#dbe5f7",
          50: "#f0f4fc",
        },
        scholar: {
          emerald: "var(--workspace-accent)",
          emeraldDark: "#126a5d",
          slate: "#94a3b8",
          charcoal: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
