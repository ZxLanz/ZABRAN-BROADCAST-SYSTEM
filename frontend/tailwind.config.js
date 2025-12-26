/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Colors (Gold/Brass Theme)
        primary: {
          50: '#fdfaf5',
          100: '#f9f3e8',
          200: '#f2e5c9',
          300: '#e9d4a3',
          400: '#e5c687',
          500: '#d4af6a',  // Main brand color
          600: '#b89654',
          700: '#9a7d45',
          800: '#7d663a',
          900: '#665330',
        },
        
        // Navy/Dark Theme Colors
        navy: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#6c757d',
          500: '#495057',
          600: '#343a40',
          700: '#212529',
          800: '#1a2332',  // Sidebar color
          900: '#0f1621',  // Header/Footer color
          950: '#0a0f1a',  // Darkest
        },
        
        // Alias for easier use
        gold: {
          light: '#e5c687',
          DEFAULT: '#d4af6a',
          dark: '#b89654',
        },
        
        dark: {
          DEFAULT: '#1a2332',
          darker: '#0f1621',
        }
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],     // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
      },
      
      spacing: {
        '18': '4.5rem',   // 72px
        '88': '22rem',    // 352px (sidebar width)
      },
      
      boxShadow: {
        'gold': '0 10px 15px -3px rgba(212, 175, 106, 0.1), 0 4px 6px -2px rgba(212, 175, 106, 0.05)',
        'gold-lg': '0 20px 25px -5px rgba(212, 175, 106, 0.15), 0 10px 10px -5px rgba(212, 175, 106, 0.04)',
      },
      
      animation: {
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      
      borderRadius: {
        'xl': '1rem',    // 16px
        '2xl': '1.5rem', // 24px
      },
    },
  },
  plugins: [],
}