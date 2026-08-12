import type { Config } from "tailwindcss";

/**
 * Casa Paella brand palette.
 * Inspired by saffron paella, Spanish gold, and warm terracotta.
 *   granate  — primary, evokes the paella crust and Spanish wine
 *   dorado   — accent, gold leaf for VIP / premium touches
 *   crema    — light background, warm and inviting
 *   carbon   — dark background, for night mode / dashboard
 *   azafran  — tertiary, the saffron yellow
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        granate: {
          50: "#FDF2F2",
          100: "#FBE3E3",
          200: "#F5BFBF",
          300: "#EC9090",
          400: "#D85858",
          500: "#C1272D", // primary
          600: "#A11A20",
          700: "#7C1419",
          800: "#561013",
          900: "#330B0D",
        },
        dorado: {
          50: "#FCF6E7",
          100: "#F5E6BC",
          200: "#EBD08A",
          300: "#E0BB5E",
          400: "#D2A748",
          500: "#C9A961", // accent
          600: "#A48648",
          700: "#7B6334",
          800: "#544322",
          900: "#2D2412",
        },
        crema: {
          50: "#FFFDF7",
          100: "#FAF3E0", // bg
          200: "#F0E4C2",
          300: "#E5D49E",
        },
        azafran: {
          400: "#F4B942",
          500: "#E89A1F",
          600: "#C97A0F",
        },
        carbon: {
          50: "#F5F0EB",
          100: "#2A1F18",
          200: "#231A14",
          300: "#1A1410", // bg dark
          400: "#0F0B08",
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "warm-sm": "0 1px 2px rgba(193, 39, 45, 0.06)",
        warm: "0 4px 16px rgba(193, 39, 45, 0.08)",
        "warm-lg": "0 10px 32px rgba(193, 39, 45, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
