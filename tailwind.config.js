module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        animation: {
          'pulse-slow': 'pulse-slow 20s infinite ease-in-out',
          'pulse-slow-reverse': 'pulse-slow-reverse 20s infinite ease-in-out',
        },
        keyframes: {
          'pulse-slow': {
            '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.1' },
            '50%': { transform: 'scale(1.2) rotate(10deg)', opacity: '0.2' },
          },
          'pulse-slow-reverse': {
              '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.2' },
              '50%': { transform: 'scale(1.2) rotate(-10deg)', opacity: '0.1' },
          }
        }
      },
    },
    plugins: [],
  }