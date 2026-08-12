import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#0795A5',
          DEFAULT: '#20CAD8',
          light: '#CFF7FA',
        },
        secondary: {
          dark: '#071624',
          DEFAULT: '#0B1F33',
          light: '#173B5E',
        },
        neutral: {
          background: '#F4F8FA',
          text: '#344B5F',
          divisor: '#E7EFF3',
          details: '#CFDDE4',
          white: '#FFFFFF',
          black: '#000000',
        },
        feedback: {
          attention: '#F5B942',
          negative: '#E5484D',
          positive: '#22A968',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        exo: ['Manrope', 'sans-serif'],
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
        'elevation-1': '0 6px 20px rgba(11,31,51,0.08)',
        'elevation-2': '0 14px 36px rgba(11,31,51,0.14)',
        'elevation-3': '0 20px 54px rgba(11,31,51,0.18)',
      },
      borderRadius: {
        xs: '10px',
        modal: '22px',
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
