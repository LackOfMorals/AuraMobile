import { useColorScheme } from 'react-native';

// Tokens from the web console's theme, kept so the two stay recognisably one product.
const light = {
  bg: '#f4f7fa',
  card: '#ffffff',
  text: '#0f2233',
  muted: '#53697d',
  primary: '#0a6190',
  onPrimary: '#ffffff',
  border: '#d5dee7',
  danger: '#b3261e',
};

const dark: typeof light = {
  bg: '#0b1520',
  card: '#15283a',
  text: '#eef3f8',
  muted: '#9db1c4',
  primary: '#5db3f0',
  onPrimary: '#0b1520',
  border: '#27405a',
  danger: '#ff8a80',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
