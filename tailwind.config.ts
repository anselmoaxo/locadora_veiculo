import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#E28634',
          DEFAULT: '#F29849',
          light: '#FFDAB8',
        },
        secondary: {
          dark: '#23384D',
          DEFAULT: '#1D2F40',
          light: '#2E4B66',
        },
        neutral: {
          background: '#FBFBFB',
          text: '#444444',
          divisor: '#F2F2F2',
          details: '#E7E7E7',
          white: '#FFFFFF',
          black: '#000000',
        },
        feedback: {
          attention: '#FFD400',
          negative: '#FF3F48',
          positive: '#6EDC3B',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        exo: ['"Exo 2"', 'sans-serif'],
        icons: ['"Material Icons"', 'sans-serif'],
      },
      fontSize: {
        'body-sm': ['13px', { lineHeight: '1.2' }],
        'body-md': ['16px', { lineHeight: '1.2' }],
        'body-lg': ['20px', { lineHeight: '1.2' }],
        'heading-xs': ['25px', { lineHeight: '1.25', fontWeight: '700' }],
        'heading-sm': ['31px', { lineHeight: '1.25', fontWeight: '700' }],
        'heading-md': ['39px', { lineHeight: '1.25', fontWeight: '700' }],
      },
      boxShadow: {
        'elevation-1': '0 0 10px rgba(132,132,132,0.10)',
        'elevation-2': '0 0 20px rgba(132,132,132,0.20)',
        'elevation-3': '0 0 30px rgba(132,132,132,0.25)',
      },
      borderRadius: {
        xs: '4px',
        modal: '16px',
      },
      flex: {
        '2': '2 2 0%',
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '32px',
        xl: '40px',
      },
    },
  },
  plugins: [],
}

export default config
