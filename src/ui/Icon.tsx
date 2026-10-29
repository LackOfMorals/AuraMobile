import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type IconName = 'search' | 'filter' | 'x' | 'copy' | 'check' | 'sync' | 'alert' | 'pause' | 'stop' | 'dot' | 'back' | 'home' | 'list' | 'history' | 'person';

type Props = { name: IconName; size?: number; color: string };

/** Simple stroke icons on a 24 grid. Decorative: the meaning is always in nearby text. */
export function Icon({ name, size = 20, color }: Props) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      {shape(name, color)}
    </Svg>
  );
}

function shape(name: IconName, color: string) {
  switch (name) {
    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="8" />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
    case 'filter':
      return <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />;
    case 'x':
      return (
        <>
          <Line x1="18" y1="6" x2="6" y2="18" />
          <Line x1="6" y1="6" x2="18" y2="18" />
        </>
      );
    case 'copy':
      return (
        <>
          <Rect x="9" y="9" width="13" height="13" rx="2" />
          <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      );
    case 'check':
      return <Polyline points="20 6 9 17 4 12" />;
    case 'sync':
      return (
        <>
          <Polyline points="23 4 23 10 17 10" />
          <Polyline points="1 20 1 14 7 14" />
          <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </>
      );
    case 'alert':
      return (
        <>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="12" y1="8" x2="12" y2="12" />
          <Line x1="12" y1="16" x2="12.01" y2="16" />
        </>
      );
    case 'pause':
      return (
        <>
          <Rect x="6" y="4" width="4" height="16" />
          <Rect x="14" y="4" width="4" height="16" />
        </>
      );
    case 'stop':
      return <Rect x="5" y="5" width="14" height="14" rx="2" />;
    case 'dot':
      return <Circle cx="12" cy="12" r="5" fill={color} />;
    case 'back':
      return <Polyline points="15 18 9 12 15 6" />;
    case 'home':
      return (
        <>
          <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </>
      );
    case 'list':
      return (
        <>
          <Line x1="8" y1="6" x2="21" y2="6" />
          <Line x1="8" y1="12" x2="21" y2="12" />
          <Line x1="8" y1="18" x2="21" y2="18" />
          <Line x1="3" y1="6" x2="3.01" y2="6" />
          <Line x1="3" y1="12" x2="3.01" y2="12" />
          <Line x1="3" y1="18" x2="3.01" y2="18" />
        </>
      );
    case 'history':
      return (
        <>
          <Circle cx="12" cy="12" r="10" />
          <Polyline points="12 6 12 12 16 14" />
        </>
      );
    case 'person':
      return (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
        </>
      );
  }
}
