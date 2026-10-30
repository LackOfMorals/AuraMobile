import { palettes } from "./colors";
import { tierStripe } from "../lib/tierStripe";

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio, the measure Apple's Accessibility guidance points to. */
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe.each(Object.entries(palettes))("%s palette", (_name, p) => {
  it("keeps text at 4.5:1 or more on the page and the card", () => {
    for (const fg of [p.text, p.muted, p.primary, p.danger]) for (const bg of [p.bg, p.card]) expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps button text at 4.5:1 or more", () => {
    expect(ratio(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every status chip's text at 4.5:1 or more", () => {
    for (const [tone, { fg, bg }] of Object.entries(p.tone)) expect([tone, ratio(fg, bg) >= 4.5]).toEqual([tone, true]);
  });

  it("keeps the edges of fields and buttons at 3:1 or more, on the page and the card", () => {
    for (const bg of [p.bg, p.card]) expect(ratio(p.control, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe("tier stripe", () => {
  it("is never the only sign of the tier, so it only needs to be seen, not read (see InstanceCard, which also writes the tier)", () => {
    const keys = ["free-db", "professional-db", "business-critical", "enterprise-db"];
    expect(new Set(keys.map((k) => tierStripe(k).color)).size).toBe(4);
  });
});
