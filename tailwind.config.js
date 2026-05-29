/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        xs:   ['0.75rem',   { lineHeight: '1.125rem' }],
        sm:   ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg:   ['1.0625rem', { lineHeight: '1.625rem' }],
        xl:   ['1.1875rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.375rem', { lineHeight: '1.875rem' }],
        '3xl': ['1.625rem', { lineHeight: '2.125rem' }],
        '4xl': ['2rem',     { lineHeight: '2.375rem' }],
        '5xl': ['2.5rem',   { lineHeight: '2.75rem' }],
      },
    },
  },
  plugins: [],
};
