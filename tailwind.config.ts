import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        forest: '#114B39',
        'forest-dark': '#0B3326',
        gold: '#C98A2C',
        'gold-light': '#FFC107',
        moss: '#5C8D5A',
        cream: '#F3F7F5', // Latar sistem
        'fama-green': '#124028',
        'fama-lime': '#83C341', // Hijau FAMA
        'fama-blue': '#114F8B', // Biru FAMA
      },
    },
  },
  plugins: [],
};

export default config;
