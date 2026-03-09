/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cc: {
          dark: '#0f172a',
          nav: '#1e293b',
          accent: '#7c3aed',
          light: '#ede9fe',
        },
      },
    },
  },
  plugins: [],
}
