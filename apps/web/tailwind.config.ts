import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--gk-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EEF2FA', 100: '#D9E1F2', 200: '#B3C2E3', 300: '#8099CC', 400: '#4F6FB0',
          500: '#2E5094', 600: '#244485', 700: '#1D3B7A', 800: '#13285A', 900: '#0B1B3F', 950: '#060E22',
        },
        emerald: {
          50: '#E8F7F1', 100: '#C9EDDF', 200: '#9BDDC5', 300: '#62C7A6', 400: '#2FB38C', 500: '#12A37E',
          600: '#0E8A6A', 650: '#0C7F62', 700: '#0B6F56', 800: '#095845', 900: '#074536', 950: '#03271E',
        },
        gold: {
          50: '#FBF7EC', 100: '#F6EDD6', 200: '#EBD9A8', 300: '#DEC17A', 400: '#D3AD5D',
          500: '#C8A04A', 600: '#A9832F', 700: '#846524', 800: '#5F481A', 900: '#3F3012',
        },
        slate: {
          25: '#FCFCFD', 50: '#F9FAFB', 100: '#F2F4F7', 200: '#EAECF0', 300: '#D0D5DD', 400: '#98A2B3',
          450: '#7A8599', 500: '#667085', 600: '#475467', 700: '#344054', 800: '#1D2939', 900: '#101828',
        },
        ink: { 900: '#111827' },
        paper: '#FBFAF7',
        warning: { 50: '#FDF6E0', 100: '#FAE9B3', 500: '#E0A100', 600: '#B98500', 700: '#8F6600', 800: '#6B4D00' },
        danger: { 50: '#FDEDED', 100: '#FAD4D4', 500: '#E25C5C', 600: '#D14343', 700: '#B03232', 800: '#8C2828' },
        info: { 50: '#EDF3FD', 100: '#D6E4FA', 500: '#3B73D9', 600: '#2B5FC0', 700: '#224C9A', 800: '#1A3B78' },

        canvas: { DEFAULT: v('canvas'), tint: v('canvas-tint') },
        surface: { DEFAULT: v('surface'), raised: v('surface-raised'), sunken: v('surface-sunken') },
        line: { DEFAULT: v('line'), strong: v('line-strong') },
        fg: {
          DEFAULT: v('fg'), muted: v('fg-muted'), subtle: v('fg-subtle'),
          heading: v('fg-heading'), 'on-brand': v('fg-on-brand'),
        },
        brand: { DEFAULT: v('brand'), hover: v('brand-hover'), fg: v('brand-fg') },
        primary: { DEFAULT: v('navy'), hover: v('navy-hover') },
        focus: v('focus'),
        accent: { gold: v('gold') },
        critical: { DEFAULT: v('danger'), hover: v('danger-hover'), fg: v('danger-fg') },
        status: {
          'success-bg': v('success-bg'), 'success-fg': v('success-fg'), 'success-dot': v('success-dot'),
          'warning-bg': v('warning-bg'), 'warning-fg': v('warning-fg'), 'warning-dot': v('warning-dot'),
          'danger-bg': v('danger-bg'), 'danger-fg': v('danger-chip-fg'), 'danger-dot': v('danger-dot'),
          'info-bg': v('info-bg'), 'info-fg': v('info-fg'), 'info-dot': v('info-dot'),
          'neutral-bg': v('neutral-bg'), 'neutral-fg': v('neutral-fg'), 'neutral-dot': v('neutral-dot'),
          'gold-bg': v('gold-bg'), 'gold-fg': v('gold-fg'), 'gold-dot': v('gold-dot'),
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['4.5rem', { lineHeight: '1.02', letterSpacing: '-0.025em', fontWeight: '500' }],
        'display-xl': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-lg': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.015em', fontWeight: '500' }],
        'display-md': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        h1: ['1.75rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],
        h2: ['1.375rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        h3: ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.005em', fontWeight: '600' }],
        h4: ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.55' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        label: ['0.875rem', { lineHeight: '1.3', letterSpacing: '0.005em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        'numeric-xl': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'numeric-lg': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        passcode: ['2rem', { lineHeight: '1', letterSpacing: '0.12em', fontWeight: '600' }],
        'guard-xl': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '700' }],
        'guard-body': ['1.25rem', { lineHeight: '1.45', fontWeight: '500' }],
      },
      borderRadius: { xs: '4px', sm: '6px', control: '10px', card: '12px', sheet: '20px', panel: '24px' },
      boxShadow: {
        xs: 'var(--gk-shadow-xs)',
        card: 'var(--gk-shadow-card)',
        raised: 'var(--gk-shadow-raised)',
        overlay: 'var(--gk-shadow-overlay)',
        focus: '0 0 0 2px rgb(var(--gk-ring-offset)), 0 0 0 4px rgb(var(--gk-focus))',
        sos: '0 0 0 8px rgb(209 67 67 / .12), 0 12px 32px rgb(209 67 67 / .28)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
      },
      transitionDuration: { instant: '80ms', fast: '140ms', base: '200ms', slow: '320ms', deliberate: '480ms' },
      zIndex: {
        raised: '10', sticky: '100', sidebar: '150', dropdown: '200', overlay: '300',
        modal: '400', toast: '500', sos: '600', tooltip: '700',
      },
      keyframes: {
        'dot-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'row-flash': { '0%': { backgroundColor: 'rgb(var(--gk-warning-bg))' }, '100%': { backgroundColor: 'transparent' } },
        'ledger-in': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        rise: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        'dot-pulse': 'dot-pulse 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        'row-flash': 'row-flash 1.2s cubic-bezier(0.2,0,0,1) 1',
        'ledger-in': 'ledger-in 480ms cubic-bezier(0.05,0.7,0.1,1) both',
        rise: 'rise 320ms cubic-bezier(0.05,0.7,0.1,1) both',
      },
      maxWidth: { prose: '68ch', app: '1280px', form: '640px' },
    },
  },
  plugins: [],
} satisfies Config;

