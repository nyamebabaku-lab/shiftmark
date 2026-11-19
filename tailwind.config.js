/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344' },
        ink: { 700: '#1e293b', 800: '#131c2e', 900: '#0f172a', 950: '#0a1020' },
      },
      boxShadow: { soft: '0 1px 2px rgba(15,23,42,.05), 0 6px 20px rgba(15,23,42,.07)' },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        ping2: { '75%,100%': { transform: 'scale(1.9)', opacity: 0 } },
      },
      animation: { 'fade-in': 'fade-in .25s ease-out', 'slide-up': 'slide-up .25s cubic-bezier(.2,.8,.2,1)', ping2: 'ping2 1.8s cubic-bezier(0,0,.2,1) infinite' },
    },
  },
  plugins: [],
};
