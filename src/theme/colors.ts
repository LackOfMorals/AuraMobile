import { useColorScheme } from 'react-native';

// Tokens from the web console's theme, kept so the two stay recognisably one product.
type ToneColors = { fg: string; bg: string };

const light = {
  bg: '#f4f7fa',
  card: '#ffffff',
  text: '#0f2233',
  muted: '#53697d',
  primary: '#0a6190',
  onPrimary: '#ffffff',
  border: '#d5dee7',
  /** Edges of things you tap or type in: 3:1 against the page and the card, which `border` is not. */
  control: '#6f8397',
  danger: '#b3261e',
  tone: {
    ok: { fg: '#187335', bg: '#e3f4e8' },
    info: { fg: '#0a6190', bg: '#dceaf4' },
    neutral: { fg: '#53697d', bg: '#e6ecf1' },
    danger: { fg: '#b3261e', bg: '#fbe4e2' },
    warn: { fg: '#8a5a00', bg: '#fdf0d5' },
  } as Record<'ok' | 'info' | 'neutral' | 'danger' | 'warn', ToneColors>,
};

const dark: typeof light = {
  bg: '#0b1520',
  card: '#15283a',
  text: '#eef3f8',
  muted: '#9db1c4',
  primary: '#5db3f0',
  onPrimary: '#0b1520',
  border: '#27405a',
  control: '#6a85a0',
  danger: '#ff8a80',
  tone: {
    ok: { fg: '#7ddc98', bg: '#12301f' },
    info: { fg: '#5db3f0', bg: '#11344d' },
    neutral: { fg: '#9db1c4', bg: '#223547' },
    danger: { fg: '#ff8a80', bg: '#3d1b19' },
    warn: { fg: '#f2c562', bg: '#3b2e0e' },
  },
};

export type Colors = typeof light;

/** Both palettes, so a test can check their contrast. */
export const palettes = { light, dark };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
