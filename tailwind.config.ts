import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bv: {
          bg: '#0c0a08',
          surface: '#131008',
          elevated: '#1a160f',
          border: '#2a2218',
          'border-light': '#3a3025',
          gold: '#d4a853',
          'gold-light': '#f0c97a',
          'gold-muted': '#8a6830',
          'gold-subtle': '#1e1608',
          text: '#f0ebe3',
          muted: '#9a8e7a',
          subtle: '#5a5040',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'pulse-gold': 'pulseGold 3s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'gold-sm': '0 0 20px rgba(212, 168, 83, 0.15)',
        gold: '0 0 40px rgba(212, 168, 83, 0.2)',
        'gold-lg': '0 0 80px rgba(212, 168, 83, 0.25)',
        book: '6px 8px 30px rgba(0,0,0,0.7), 2px 2px 8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}

export default config
