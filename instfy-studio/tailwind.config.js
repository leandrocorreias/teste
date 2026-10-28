/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#14201B', soft: '#3A4A43', mute: '#5B6C64' },
        paper: { DEFAULT: '#F7F6F1', alt: '#EFEDE5', line: '#DEDBD0' },
        forest: { 900: '#0A1F18', 800: '#0E2A20', 700: '#123528', 600: '#1A4635', 500: '#2A6450' },
        lime: { DEFAULT: '#C3F53C', 600: '#A8D92A', 300: '#DCF98F' },
        bronze: { DEFAULT: '#C2A26B', soft: '#E2D3B5' },
        signal: { fact: '#1A4635', hypo: '#9A6B1F', danger: '#8E2B1E' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { kicker: '0.18em' },
    },
  },
  plugins: [],
};
