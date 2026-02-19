/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: '#0f0f12',
        'background-card': '#18181c',
        'background-hover': '#222228',
        border: '#2a2a32',
        accent: '#22c55e',
        'accent-hover': '#16a34a',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
      },
    },
  },
  plugins: [],
};

