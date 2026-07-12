import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF4D00',
        secondary: '#2D6A4F',
        'brand-bg': '#FCF9F8',
        'brand-border': '#1A1A1A',
        'brand-text': '#1C1B1B',
        'brand-surface': '#FFFFFF',
        'brand-muted': '#5C4037',
        'brand-outline': '#916F65',
        error: '#BA1A1A',
        success: '#2D6A4F',
      },
      fontFamily: {
        headline: ['Space Grotesk', 'sans-serif'],
        body: ['Hanken Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
