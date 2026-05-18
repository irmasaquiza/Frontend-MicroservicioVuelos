/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:         '#111827',
        'navy-light': '#B9151B',
        'blue-accent':'#D71920',
        gold:         '#D71920',
        'gold-light': '#EF4444',
        'gold-dark':  '#B9151B',
        background:   '#FFF7F7',
        border:       '#F3D6D8',
        'text-muted': '#6B7280',
        'text-main':  '#111827',
        success:      '#22C55E',
        error:        '#EF4444',
        warning:      '#F59E0B',
      },
    },
  },
  plugins: [],
}
