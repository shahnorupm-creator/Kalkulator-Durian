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
        forest: '#1F4D36',
        'forest-dark': '#0C2D1C',
        gold: '#C98A2C',
        'gold-light': '#FFC107',
        moss: '#5C8D5A',
        cream: '#F8FAFC',
        'fama-green': '#124028',
      },
    },
  },
  plugins: [],
};

export default config;
