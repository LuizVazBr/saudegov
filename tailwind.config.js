/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  safelist: [
    "w-full",
    "w-4/5",
    "w-3/4",
    "w-40",
  ],
  plugins: [
    //require("daisyui"),
    require("tailwind-scrollbar-hide"),
  ],
  daisyui: {
    themes: ["light", "dark"], // você pode definir os temas que quer ativar (ou personalizar aqui)
  },
};
