/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'card-glow': 'card-glow 4s ease-in-out infinite',
        'element-glow': 'element-glow 4s ease-in-out infinite',
      },
      keyframes: {
        'card-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(0, 0, 0, 0.05), 0 0 40px rgba(0, 0, 0, 0.02)',
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(0, 0, 0, 0.1), 0 0 50px rgba(0, 0, 0, 0.05)',
          },
        },
        'element-glow': {
            '0%, 100%': {
                filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.3))',
            },
            '50%': {
                filter: 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.4))',
            }
        }
      },
    },
  },
  plugins: [],
}
