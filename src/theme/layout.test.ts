import { columnsFor, MAX_LIST_WIDTH, MAX_READING_WIDTH } from "./layout";

describe("columnsFor", () => {
  it("is one column on every iPhone, including the largest and in landscape-sized widths up to a tablet", () => {
    for (const width of [320, 375, 393, 402, 430, 440, 699]) expect(columnsFor(width)).toBe(1);
  });
  it("is two columns on a tablet in portrait, such as an iPad mini (744) or iPad Pro 11-inch (834)", () => {
    for (const width of [700, 744, 820, 834, 999]) expect(columnsFor(width)).toBe(2);
  });
  it("is three columns on a wide window, such as an iPad Pro 13-inch (1032) or landscape", () => {
    for (const width of [1000, 1032, 1194, 1366]) expect(columnsFor(width)).toBe(3);
  });
  it("keeps reading width under the list width", () => {
    expect(MAX_READING_WIDTH).toBeLessThan(MAX_LIST_WIDTH);
  });
});
