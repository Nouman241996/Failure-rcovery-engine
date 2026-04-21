/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0b0d12', surface: '#13161d', elevated: '#1a1e27' },
        border: { DEFAULT: '#23283180', strong: '#2d333d' },
        accent: { DEFAULT: '#6366f1', soft: '#818cf81a' },
        success: { DEFAULT: '#10b981', soft: '#10b9811a' },
        warning: { DEFAULT: '#f59e0b', soft: '#f59e0b1a' },
        danger:  { DEFAULT: '#ef4444', soft: '#ef44441a' },
        muted:   { DEFAULT: '#9ca3af' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
