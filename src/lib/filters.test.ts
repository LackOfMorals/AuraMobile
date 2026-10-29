// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { SORTS, activeCount, emptyFilters, facetCounts, matches, parseFilters, serializeFilters, sortInstances, type Filterable, type Filters } from "./filters";

describe("the route params", () => {
  it("round-trips every filter", () => {
    const f = parseFilters({ q: "prod", t: "t1,t2", c: "gcp,aws", tier: "professional-db", st: "READY,FAILED", rm: "1", s: "memory" });
    expect(f).toEqual({ q: "prod", tenants: ["t1", "t2"], clouds: ["gcp", "aws"], tiers: ["professional-db"], statuses: ["READY", "FAILED"], showRemoved: true, sort: "memory" });
    expect(parseFilters(serializeFilters(f))).toEqual(f);
  });

  it("gives no params for no filters", () => {
    expect(serializeFilters(emptyFilters)).toEqual({});
    expect(parseFilters({})).toEqual(emptyFilters);
  });

  it("ignores what it does not understand", () => {
    const f = parseFilters({ st: "READY,BOGUS,,IN_PROGRESS", s: "sideways", rm: "yes", t: ",," });
    expect(f.statuses).toEqual(["READY", "IN_PROGRESS"]);
    expect(f.sort).toBe("name");
    expect(f.showRemoved).toBe(false);
    expect(f.tenants).toEqual([]);
  });

  it("does not include the default sort", () => {
    expect(serializeFilters({ ...emptyFilters, sort: "name" }).s).toBeUndefined();
    expect(serializeFilters({ ...emptyFilters, sort: "newest" }).s).toBe("newest");
  });
});

describe("activeCount", () => {
  it("counts each chosen option, the search and the removed switch, but not the sort", () => {
    expect(activeCount(emptyFilters)).toBe(0);
    expect(activeCount({ ...emptyFilters, sort: "newest" })).toBe(0);
    expect(activeCount({ ...emptyFilters, q: "x", tenants: ["a", "b"], clouds: ["gcp"], tiers: ["t"], statuses: ["READY"], showRemoved: true })).toBe(7);
  });
  it("does not count a search of only spaces", () => {
    expect(activeCount({ ...emptyFilters, q: "   " })).toBe(0);
  });
});

const inst = (name: string, over: Partial<Filterable> = {}): Filterable => ({
  name, tenantId: "t1", cloudProvider: "gcp", tier: "professional-db", statusGroup: "READY", deletedInAuraAt: null, ...over,
});

describe("matches", () => {
  const all: Filters = { q: "prod", tenants: ["t1"], clouds: ["gcp"], tiers: ["professional-db"], statuses: ["READY"], showRemoved: false, sort: "name" };

  it("hides instances Aura no longer lists, unless asked", () => {
    const gone = inst("a", { deletedInAuraAt: "2026-01-01T00:00:00Z" });
    expect(matches(gone, emptyFilters)).toBe(false);
    expect(matches(gone, { ...emptyFilters, showRemoved: true })).toBe(true);
  });

  it("combines every filter with AND", () => {
    expect(matches(inst("orders-prod"), all)).toBe(true);
    expect(matches(inst("orders-dev"), all)).toBe(false);
    expect(matches(inst("orders-prod", { tenantId: "t2" }), all)).toBe(false);
    expect(matches(inst("orders-prod", { cloudProvider: "aws" }), all)).toBe(false);
    expect(matches(inst("orders-prod", { tier: "free-db" }), all)).toBe(false);
    expect(matches(inst("orders-prod", { statusGroup: "FAILED" }), all)).toBe(false);
  });

  it("searches the name without regard to case", () => {
    expect(matches(inst("Orders-PROD"), { ...emptyFilters, q: "orders-prod" })).toBe(true);
    expect(matches(inst("orders-prod"), { ...emptyFilters, q: "ORDERS" })).toBe(true);
  });

  it("ignores a search of only spaces", () => {
    expect(matches(inst("anything"), { ...emptyFilters, q: "  " })).toBe(true);
  });

  it("leaves out one facet's own filter when asked, and nothing else", () => {
    const other = inst("orders-prod", { cloudProvider: "aws" });
    expect(matches(other, all)).toBe(false);
    expect(matches(other, all, "clouds")).toBe(true);
    expect(matches(inst("orders-dev", { cloudProvider: "aws" }), all, "clouds")).toBe(false);
  });
});

describe("facetCounts", () => {
  const items = [inst("a-prod"), inst("b-prod", { cloudProvider: "aws" }), inst("c-prod", { cloudProvider: "aws" }), inst("d-dev", { cloudProvider: "azure" })];

  it("counts what picking each option would give, keeping the other filters", () => {
    const f = { ...emptyFilters, q: "prod", clouds: ["gcp"] };
    expect([...facetCounts(items, f, "clouds")]).toEqual([["gcp", 1], ["aws", 2]]);
  });

  it("counts status groups", () => {
    const list = [inst("a"), inst("b", { statusGroup: "FAILED" }), inst("c", { statusGroup: "FAILED" })];
    expect(facetCounts(list, emptyFilters, "statuses").get("FAILED")).toBe(2);
  });

  it("skips instances with no value for the facet", () => {
    expect(facetCounts([inst("a", { tier: null })], emptyFilters, "tiers").size).toBe(0);
  });
});

describe("sortInstances", () => {
  const i = (name: string, over: Partial<{ createdAt: string | null; statusGroup: "READY" | "STOPPED" | "IN_PROGRESS" | "FAILED"; memory: string | null }> = {}) => ({
    name, createdAt: null, statusGroup: "READY" as const, memory: null, ...over,
  });
  const names = (xs: { name: string }[]) => xs.map((x) => x.name);

  it("offers four sorts", () => {
    expect(SORTS.map((s) => s.key)).toEqual(["name", "newest", "status", "memory"]);
  });

  it("sorts by name, numbers as numbers and case ignored", () => {
    expect(names(sortInstances([i("db-10"), i("DB-2"), i("alpha")], "name"))).toEqual(["alpha", "DB-2", "db-10"]);
  });

  it("puts the newest first, and those with no date last, by name", () => {
    const list = [i("old", { createdAt: "2026-01-01T00:00:00Z" }), i("none-b"), i("new", { createdAt: "2026-06-01T00:00:00Z" }), i("none-a")];
    expect(names(sortInstances(list, "newest"))).toEqual(["new", "old", "none-a", "none-b"]);
  });

  it("puts what needs attention first: failed, in progress, stopped, then ready", () => {
    const list = [i("a-ready"), i("b-stopped", { statusGroup: "STOPPED" }), i("c-progress", { statusGroup: "IN_PROGRESS" }), i("d-failed", { statusGroup: "FAILED" }), i("e-ready")];
    expect(names(sortInstances(list, "status"))).toEqual(["d-failed", "c-progress", "b-stopped", "a-ready", "e-ready"]);
  });

  it("sorts memory as a number, largest first (16 GB is bigger than 2 GB), with no memory last", () => {
    const list = [i("two", { memory: "2GB" }), i("sixteen", { memory: "16GB" }), i("none"), i("eight", { memory: "8GB" }), i("sixteen-b", { memory: "16GB" })];
    expect(names(sortInstances(list, "memory"))).toEqual(["sixteen", "sixteen-b", "eight", "two", "none"]);
  });

  it("does not change the list it was given", () => {
    const list = [i("b"), i("a")];
    sortInstances(list, "name");
    expect(names(list)).toEqual(["b", "a"]);
  });
});
