import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#eef8f2",
          100: "#d8efe2",
          200: "#b7dec8",
          500: "#23835a",
          600: "#176a48",
          700: "#11543a",
          900: "#0d2e22"
        },
        honey: {
          50: "#fff7e8",
          100: "#ffedc7",
          500: "#f2a12a",
          600: "#d98215"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 42, 32, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
