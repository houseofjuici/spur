import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/web/**/*.{js,jsx,ts,tsx}',
    './src/extension/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Ethereal Blue Dream palette
        primary: {
          50: '#F0F7FF',
          100: '#E0F0FF',
          200: '#C7E6FF',
          300: '#A3D5FF',
          400: '#7FB3D3',
          500: '#5B91B3',
          600: '#417293',
          700: '#2D5373',
          800: '#1F3448',
          900: '#111B1E',
        },
        accent: {
          50: '#FFF5F0',
          100: '#FFE8E0',
          200: '#FFD5C7',
          300: '#FFB8A3',
          400: '#FF9073',
          500: '#FF6843',
          600: '#E55A3B',
          700: '#C74C33',
          800: '#A53D2B',
          900: '#832F23',
        },
        neutral: {
          50: '#F8F9FA',
          100: '#E9ECEF',
          200: '#DEE2E6',
          300: '#CED4DA',
          400: '#ADB5BD',
          500: '#6C757D',
          600: '#495057',
          700: '#343A40',
          800: '#212529',
          900: '#0F0F0F',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.8' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'ethereal-blue': 'linear-gradient(135deg, #7FB3D3 0%, #C7CEEA 100%)',
      },
      boxShadow: {
        'ethereal': '0 4px 20px rgba(127, 179, 211, 0.1)',
        'ethereal-lg': '0 8px 40px rgba(127, 179, 211, 0.15)',
        'ethereal-xl': '0 20px 60px rgba(127, 179, 211, 0.2)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
    plugin(({ addVariant }) => {
      addVariant('children', '& > *')
      addVariant('hover', '&:hover')
    }),
  ],
}