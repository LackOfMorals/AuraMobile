import { useWindowDimensions, type ViewStyle } from 'react-native';

/** Text and forms stop growing here, so a line never runs the width of an iPad. */
export const MAX_READING_WIDTH = 720;
/** Lists of cards may use more of a wide screen, in columns. */
export const MAX_LIST_WIDTH = 1180;

/** Spread into a screen's content style to centre it at a readable width. On a phone it is simply the full width. */
export const readingColumn: ViewStyle = { width: '100%', maxWidth: MAX_READING_WIDTH, alignSelf: 'center' };
export const listColumn: ViewStyle = { width: '100%', maxWidth: MAX_LIST_WIDTH, alignSelf: 'center' };

/** How many columns of cards fit: one on a phone, two on a tablet in portrait, three on a wide window. */
export function columnsFor(width: number): number {
  if (width >= 1000) {
    return 3;
  }
  return width >= 700 ? 2 : 1;
}

export const useColumns = (): number => columnsFor(useWindowDimensions().width);
