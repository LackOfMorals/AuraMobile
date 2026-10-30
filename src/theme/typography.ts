/**
 * Big headings stop growing sooner than body text. Dynamic Type scales body text a long way (Apple's own Body is 53 pt at the
 * largest accessibility size) but a 32 pt heading scaled that far is wider than a phone, and a word like "instance" breaks in
 * the middle. At 1.6 times the heading is still larger than the body text beside it and wraps between words. Body text still scales
 * fully, because that is what people turn the setting up to read.
 */
export const HEADING_FROM = 24;
export const HEADING_MAX_SCALE = 1.6;

export function maxScaleFor(fontSize: number | undefined): number | undefined {
  return fontSize !== undefined && fontSize >= HEADING_FROM ? HEADING_MAX_SCALE : undefined;
}
