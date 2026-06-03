/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Archivo", "sans-serif"],
        body: ["Hanken Grotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
};
