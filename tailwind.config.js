/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        es: {
          event: '#FF9F1C',       // Orange square, past tense
          hotspot: '#FF2E88',     // Neon pink square, friction/question
          actor: '#FFD43B',       // Yellow compact square, role/persona
          system: '#F7B7D2',      // Wide pink rectangle, tool/external service
          opportunity: '#2FA84F', // Dark green square, positive improvement
          command: '#6FB7FF',     // Bright blue square, action/decision
          policy: '#C9A7EB',      // Lilac wide rectangle, "Whenever X Then Y"
          readmodel: '#C6F2B0',   // Light green square, view/data projection
          constraint: '#FFF7B8',  // Pale yellow large square, consistency rule/aggregate
          valuePos: '#2FA84F',    // Positive value indicator
          valueNeg: '#FF6B6B',    // Negative value indicator
        },
      },
      fontFamily: {
        handwriting: ['"Permanent Marker"', 'cursive', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
