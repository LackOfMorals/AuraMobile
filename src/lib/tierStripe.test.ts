import { tierStripe } from "./tierStripe";

describe("tierStripe", () => {
  it("gives each of the four tiers its own colour", () => {
    const colours = ["free-db", "professional-db", "business-critical", "enterprise-db"].map((t) => tierStripe(t).color);
    expect(new Set(colours).size).toBe(4);
  });
  it("gives a data-science tier the colour of its database tier", () => {
    expect(tierStripe("professional-ds")).toEqual(tierStripe("professional-db"));
    expect(tierStripe("enterprise-ds")).toEqual(tierStripe("enterprise-db"));
  });
  it("uses a neutral colour for no tier or one it does not know", () => {
    expect(tierStripe(null)).toEqual(tierStripe("future-db"));
    expect(tierStripe(undefined).key).toBe("other");
    expect(tierStripe("future-db").color).not.toBe(tierStripe("free-db").color);
  });
});
