/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base':       '#EDEAE3',
        'bg-surface':    '#F5F2EB',
        'bg-dark':       '#141A12',
        'bg-dark-mid':   '#1C2419',
        'bg-dark-subtle':'#232E1F',
        'accent':        '#5C8F68',
        'accent-light':  '#7DB88A',
        'accent-italic': '#6FA876',
        'risk-low':      '#5C8F68',
        'risk-medium':   '#C4A84F',
        'risk-high':     '#C47A3A',
        'risk-critical': '#B04040',
        'text-primary':  '#0F1410',
        'text-secondary':'#4A4A40',
        'text-muted':    '#8A8A7A',
        'text-on-dark':  '#E8E4DA',
        'canvas-bg':     '#FAF8F4',
        'canvas-stroke': '#1C1C18',
        'canvas-outline':'#C8C4B8',
        'canvas-border': '#D4CFC5',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['DM Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'sm':   '6px',
        'md':   '12px',
        'lg':   '16px',
        'xl':   '20px',
        'pill': '999px',
      },
      boxShadow: {
        'card':     '0 2px 16px rgba(0,0,0,0.06)',
        'dark':     '0 4px 32px rgba(0,0,0,0.32)',
        'elevated': '0 8px 48px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
