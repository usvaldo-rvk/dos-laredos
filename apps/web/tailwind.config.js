/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores DOS LAREDOS
        brand: {
          black: '#1a1a1a',
          gold: '#D4A04C',
          'gold-light': '#E4B86C',
          'gold-dark': '#B4803C',
        },
        // Colores semánticos
        primary: {
          50: '#f7f7f7',
          100: '#e3e3e3',
          200: '#c8c8c8',
          300: '#a4a4a4',
          400: '#818181',
          500: '#666666',
          600: '#515151',
          700: '#434343',
          800: '#383838',
          900: '#1a1a1a',
          950: '#0d0d0d',
        },
        accent: {
          50: '#fdf9f0',
          100: '#f9f0db',
          200: '#f2deb6',
          300: '#e9c688',
          400: '#D4A04C', // Principal
          500: '#c8913f',
          600: '#b37934',
          700: '#955f2d',
          800: '#7a4d2b',
          900: '#654126',
          950: '#382113',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
