/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070C18',
          900: '#0B132B',
          850: '#111B38',
          800: '#1C2541',
          700: '#26345A',
          600: '#3A506B',
          500: '#4E6C91',
        },
        cricket: {
          blue: '#1E40AF',
          gold: '#F59E0B',
          amber: '#D97706',
          orange: '#FF6B00',
          yellow: '#FBBF24',
          accentGreen: '#10B981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-blue': '0 0 25px -5px rgba(37, 99, 235, 0.35)',
        'glow-orange': '0 0 25px -5px rgba(255, 107, 0, 0.35)',
        'glow-gold': '0 0 25px -5px rgba(245, 158, 11, 0.35)',
      }
    },
  },
  plugins: [],
}
