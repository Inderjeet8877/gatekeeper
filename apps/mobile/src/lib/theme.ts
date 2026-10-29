// Tokens from docs/09-UI-UX-DESIGN-SYSTEM.md §3.3 (verbatim), plus the guard console override (§5.3).
import { createContext, useContext } from 'react';
import { Platform, useColorScheme } from 'react-native';

const palette = {
  navy: { 50: '#EEF2FA', 100: '#D9E1F2', 200: '#B3C2E3', 300: '#8099CC', 400: '#4F6FB0', 500: '#2E5094',
          600: '#244485', 700: '#1D3B7A', 800: '#13285A', 900: '#0B1B3F', 950: '#060E22' },
  emerald: { 50: '#E8F7F1', 100: '#C9EDDF', 500: '#12A37E', 600: '#0E8A6A', 650: '#0C7F62', 700: '#0B6F56', 800: '#095845' },
  gold: { 100: '#F6EDD6', 500: '#C8A04A', 800: '#5F481A' },
  slate: { 25: '#FCFCFD', 50: '#F9FAFB', 100: '#F2F4F7', 200: '#EAECF0', 300: '#D0D5DD', 400: '#98A2B3',
           450: '#7A8599', 500: '#667085', 600: '#475467', 700: '#344054', 800: '#1D2939', 900: '#101828' },
  ink900: '#111827',
  paper: '#FBFAF7',
  white: '#FFFFFF',
  danger: { 50: '#FDEDED', 600: '#D14343', 700: '#B03232', 800: '#8C2828' },
  warning: { 50: '#FDF6E0', 500: '#E0A100', 700: '#8F6600', 800: '#6B4D00' },
} as const;
export { palette };

type Tone = { bg: string; fg: string; dot: string };
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';
export type ColorTokens = {
  canvas: string; canvasTint: string; surface: string; surfaceRaised: string; surfaceSunken: string;
  line: string; lineStrong: string;
  fg: string; fgMuted: string; fgSubtle: string; fgHeading: string; fgOnBrand: string;
  brand: string; brandHover: string; brandFg: string;
  navy: string; navyHover: string; focus: string; gold: string;
  danger: string; dangerHover: string; dangerFg: string;
  overlay: string;
  status: Record<StatusTone, Tone>;
};

export const lightColors: ColorTokens = {
  canvas: palette.paper, canvasTint: palette.slate[100], surface: palette.white, surfaceRaised: palette.white,
  surfaceSunken: palette.slate[50], line: palette.slate[200], lineStrong: palette.slate[450],
  fg: palette.ink900, fgMuted: palette.slate[600], fgSubtle: palette.slate[500], fgHeading: palette.navy[900],
  fgOnBrand: palette.white,
  brand: palette.emerald[650], brandHover: palette.emerald[700], brandFg: palette.emerald[700],
  navy: palette.navy[900], navyHover: palette.navy[700], focus: palette.emerald[500], gold: palette.gold[500],
  danger: palette.danger[600], dangerHover: palette.danger[700], dangerFg: palette.danger[700],
  overlay: 'rgba(6,14,34,0.48)',
  status: {
    success: { bg: '#E8F7F1', fg: '#095845', dot: '#0E8A6A' },
    warning: { bg: '#FDF6E0', fg: '#6B4D00', dot: '#E0A100' },
    danger:  { bg: '#FDEDED', fg: '#8C2828', dot: '#D14343' },
    info:    { bg: '#EEF2FA', fg: '#13285A', dot: '#1D3B7A' },
    neutral: { bg: '#F2F4F7', fg: '#344054', dot: '#98A2B3' },
    gold:    { bg: '#F6EDD6', fg: '#5F481A', dot: '#C8A04A' },
  },
};

export const darkColors: ColorTokens = {
  canvas: '#060E22', canvasTint: '#040A19', surface: '#0C1730', surfaceRaised: '#12203F', surfaceSunken: '#081227',
  line: '#22335A', lineStrong: '#6A7BA3',
  fg: '#EEF1F7', fgMuted: '#A9B4CB', fgSubtle: '#7D89A3', fgHeading: '#FFFFFF', fgOnBrand: '#FFFFFF',
  brand: palette.emerald[650], brandHover: palette.emerald[700], brandFg: '#3CC79D',
  navy: palette.navy[800], navyHover: palette.navy[700], focus: '#3CC79D', gold: '#D9B967',
  danger: palette.danger[600], dangerHover: palette.danger[700], dangerFg: '#F07A7A',
  overlay: 'rgba(0,0,0,0.64)',
  status: {
    success: { bg: '#0F2E2A', fg: '#3CC79D', dot: '#3CC79D' },
    warning: { bg: '#2E2610', fg: '#F2C14E', dot: '#F2C14E' },
    danger:  { bg: '#351A22', fg: '#F07A7A', dot: '#F07A7A' },
    info:    { bg: '#142650', fg: '#8DB0F0', dot: '#8DB0F0' },
    neutral: { bg: '#1A2747', fg: '#A9B4CB', dot: '#7D89A3' },
    gold:    { bg: '#2C2615', fg: '#D9B967', dot: '#D9B967' },
  },
};

// Guard console (§5.3): white canvas by day, surfaces #12203F by night, no low-contrast borders or subtle text.
const guardLight: ColorTokens = { ...lightColors, canvas: palette.white, line: palette.slate[450], fgSubtle: palette.slate[600] };
const guardDark: ColorTokens = { ...darkColors, surface: '#12203F', line: '#6A7BA3', fgSubtle: '#A9B4CB' };

export const fonts = {
  display: 'Fraunces_500Medium',
  displaySemibold: 'Fraunces_600SemiBold',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

// RN letterSpacing is in points: em * fontSize
const t = (fontFamily: string, fontSize: number, lineHeight: number, em = 0) =>
  ({ fontFamily, fontSize, lineHeight, letterSpacing: +(em * fontSize).toFixed(2) });
const tab = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };

export const type = {
  display2xl: t(fonts.display, 44, 48, -0.025),
  displayXl:  t(fonts.display, 38, 42, -0.02),
  displayLg:  t(fonts.display, 30, 36, -0.015),
  displayMd:  t(fonts.displaySemibold, 26, 32, -0.01),
  h1:         t(fonts.bold, 26, 32, -0.015),
  h2:         t(fonts.bold, 21, 28, -0.01),
  h3:         t(fonts.semibold, 18, 24, -0.005),
  h4:         t(fonts.semibold, 16, 22),
  bodyLg:     t(fonts.regular, 17, 26),
  body:       t(fonts.regular, 16, 24),
  bodySm:     t(fonts.regular, 14, 20),
  label:      t(fonts.semibold, 14, 18, 0.005),
  caption:    t(fonts.medium, 12, 16, 0.01),
  numericXl:  { ...t(fonts.bold, 30, 34, -0.02), ...tab },
  numericLg:  { ...t(fonts.bold, 22, 28, -0.01), ...tab },
  passcode:   { ...t(fonts.semibold, 32, 36, 0.12), ...tab },
  guardXl:    t(fonts.bold, 34, 40, -0.01),
  guardBody:  t(fonts.medium, 20, 28),
} as const;
export type TypeVariant = keyof typeof type;

export const space = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const radii = { xs: 4, sm: 6, control: 10, card: 12, sheet: 20, panel: 24, full: 9999 } as const;

const shadow = (y: number, blur: number, opacity: number, elevation: number) =>
  Platform.select({
    ios: { shadowColor: '#101828', shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2 },
    default: { elevation },
  })!;

export const shadows = {
  xs: shadow(1, 2, 0.06, 1),
  card: shadow(8, 24, 0.08, 2),
  raised: shadow(12, 32, 0.10, 6),
  overlay: shadow(24, 48, 0.14, 12),
} as const;

export const motion = {
  duration: { instant: 80, fast: 140, base: 200, slow: 320, deliberate: 480, exit: 160, sosHold: 2000 },
  easing: { standard: [0.2, 0, 0, 1], decelerate: [0.05, 0.7, 0.1, 1], accelerate: [0.3, 0, 1, 1] },
} as const;

export const layout = {
  gutter: 16,
  touchMin: 44,          // resident/admin touch targets
  guardTouchMin: 64,     // guard console touch targets
  tabBarHeight: 64,
  icon: { sm: 16, md: 20, lg: 24, xl: 32, hero: 48 },
  iconStroke: 1.75,
  guardIconStroke: 2,
} as const;

/** True inside the (guard) group — switches to the high-contrast console theme. */
export const GuardContext = createContext(false);

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  const guard = useContext(GuardContext);
  const colors = guard ? (isDark ? guardDark : guardLight) : isDark ? darkColors : lightColors;
  return { colors, type, space, radii, shadows, motion, layout, fonts, isDark, guard };
}
export type Theme = ReturnType<typeof useTheme>;
