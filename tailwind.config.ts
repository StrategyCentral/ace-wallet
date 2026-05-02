import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ace-bg': '#0a0a12',
        'ace-card': '#12121e',
        'ace-border': 'rgba(255,255,255,0.07)',
        'ace-cyan': '#00d4ff',
        'ace-purple': '#8b5cf6',
        'ace-green': '#10b981',
        'ace-orange': '#f59e0b',
        'ace-red': '#ef4444',
        'ace-text': '#e2e8f0',
        'ace-muted': '#64748b',
      },
    },
  },
  plugins: [],
}
export default config
