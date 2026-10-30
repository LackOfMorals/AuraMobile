import { HEADING_FROM, HEADING_MAX_SCALE, maxScaleFor } from "./typography";

describe("maxScaleFor", () => {
  it("caps headings from 24 pt up, and leaves body and caption text to scale fully", () => {
    expect(maxScaleFor(HEADING_FROM)).toBe(HEADING_MAX_SCALE);
    expect(maxScaleFor(32)).toBe(HEADING_MAX_SCALE);
    expect(maxScaleFor(17)).toBeUndefined();
    expect(maxScaleFor(13)).toBeUndefined();
    expect(maxScaleFor(undefined)).toBeUndefined();
  });
});
