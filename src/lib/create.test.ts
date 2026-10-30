// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { EMPTY_CHOICE, FREE_OFFER, STEPS, tenantsOffering, tierName, tiersIn, offersFor, stepsFor, withFreeTier, choose, cloudsOf, createVariables, firstOpenStep, regionsOf, sizesOf, stepDone, tiersOf, type Choice, type Offer } from "./create";

const offer = (cloudProvider: string, region: string, regionName: string, type: string, memory: string, storage: string): Offer => ({ cloudProvider, region, regionName, type, memory, storage, version: "5" });
const OFFERS: Offer[] = [
  offer("gcp", "us-central1", "Iowa (us-central1)", "professional-db", "4GB", "8GB"),
  offer("gcp", "us-central1", "Iowa (us-central1)", "professional-db", "16GB", "32GB"),
  offer("gcp", "us-central1", "Iowa (us-central1)", "enterprise-db", "32GB", "64GB"),
  offer("gcp", "europe-west1", "Belgium (europe-west1)", "professional-db", "8GB", "16GB"),
  offer("aws", "eu-west-1", "Ireland (eu-west-1)", "free-db", "1GB", "2GB"),
  offer("aws", "eu-west-1", "Ireland (eu-west-1)", "business-critical", "8GB", "16GB"),
  offer("aws", "eu-west-1", "Ireland (eu-west-1)", "professional-db", "4GB", "8GB"),
];

describe("what each step offers", () => {
  it("lists the clouds a tenant has, sorted", () => expect(cloudsOf(OFFERS)).toEqual(["aws", "gcp"]));
  it("lists a cloud's regions by name, each once", () => {
    expect(regionsOf(OFFERS, "gcp").map((r) => r.region)).toEqual(["europe-west1", "us-central1"]);
    expect(regionsOf(OFFERS, "aws")).toEqual([{ region: "eu-west-1", regionName: "Ireland (eu-west-1)" }]);
    expect(regionsOf(OFFERS, "azure")).toEqual([]);
  });
  it("lists only the tiers offered in that region, cheapest kind first", () => {
    expect(tiersOf(OFFERS, "aws", "eu-west-1")).toEqual(["free-db", "professional-db", "business-critical"]);
    expect(tiersOf(OFFERS, "gcp", "europe-west1")).toEqual(["professional-db"]);
    expect(tiersOf(OFFERS, "gcp", "us-central1")).toEqual(["professional-db", "enterprise-db"]);
    expect(tiersOf(OFFERS, "gcp", "mars-1")).toEqual([]);
  });
  it("puts a tier it does not know last, rather than dropping it", () => {
    expect(tiersOf([...OFFERS, offer("gcp", "europe-west1", "Belgium", "future-db", "8GB", "16GB")], "gcp", "europe-west1")).toEqual(["professional-db", "future-db"]);
  });
  it("lists the sizes of one cloud, region and tier, smallest first", () => {
    expect(sizesOf(OFFERS, "gcp", "us-central1", "professional-db").map((s) => `${s.memory}|${s.storage}`)).toEqual(["4GB|8GB", "16GB|32GB"]);
    expect(sizesOf(OFFERS, "gcp", "us-central1", "free-db")).toEqual([]);
  });
});

describe("choose", () => {
  const full: Choice = { ...EMPTY_CHOICE, tenant: "t1", cloud: "gcp", region: "us-central1", type: "professional-db", size: "16GB|32GB", name: "orders", vectorOptimized: true };
  it("keeps everything when a choice is made again with the same value", () => {
    expect(choose(full, { cloud: "gcp", region: "us-central1", type: "professional-db" })).toEqual(full);
  });
  it("clears cloud, region and size when the tier or the tenant changes, but not the name or switches", () => {
    expect(choose(full, { tenant: "t2" })).toEqual({ ...full, tenant: "t2", cloud: "", region: "", size: "" });
    expect(choose(full, { type: "enterprise-db" })).toEqual({ ...full, type: "enterprise-db", cloud: "", region: "", size: "" });
  });
  it("clears region and size when the cloud changes", () => {
    expect(choose(full, { cloud: "aws" })).toMatchObject({ cloud: "aws", region: "", size: "", name: "orders" });
  });
  it("clears only the size when the region changes", () => {
    expect(choose(full, { region: "europe-west1" })).toMatchObject({ region: "europe-west1", type: "professional-db", size: "" });
  });
  it("leaves the choices alone when only the name changes", () => {
    expect(choose(full, { name: "other" })).toEqual({ ...full, name: "other" });
  });
  it("fills in everything Free fixes when Free is chosen, and turns vector off", () => {
    expect(choose(full, { type: "free-db" })).toEqual({ ...full, type: "free-db", cloud: "gcp", region: "europe-west1", size: "1GB|", vectorOptimized: false });
  });
  it("clears what Free fixed when a paid tier is chosen after it", () => {
    const free = choose(EMPTY_CHOICE, { type: "free-db", tenant: "t1" });
    expect(choose(free, { type: "professional-db" })).toMatchObject({ type: "professional-db", cloud: "", region: "", size: "" });
  });
  it("keeps Free's fixed values even if the tenant changes", () => {
    const free = choose({ ...EMPTY_CHOICE, tenant: "t1" }, { type: "free-db" });
    expect(choose(free, { tenant: "t2" })).toMatchObject({ tenant: "t2", cloud: "gcp", region: "europe-west1", size: "1GB|" });
  });
});

describe("steps", () => {
  const ALL = withFreeTier(OFFERS.map((o, i) => ({ ...o, tenantId: i % 2 === 0 ? "t1" : "t2" })), false);

  it("asks for the tier first, then moves on as each step is done", () => {
    let c = EMPTY_CHOICE;
    expect(firstOpenStep(c, OFFERS)).toBe("tier");
    c = choose(c, { type: "professional-db" });
    expect(firstOpenStep(c, OFFERS)).toBe("tenant");
    c = choose(c, { tenant: "t1" });
    expect(firstOpenStep(c, OFFERS)).toBe("cloud");
    c = choose(c, { cloud: "gcp" });
    expect(firstOpenStep(c, OFFERS)).toBe("region");
    c = choose(c, { region: "us-central1" });
    expect(firstOpenStep(c, OFFERS)).toBe("size");
    c = choose(c, { size: "4GB|8GB" });
    expect(firstOpenStep(c, OFFERS)).toBe("name");
    c = choose(c, { name: "orders" });
    expect(firstOpenStep(c, OFFERS)).toBeUndefined();
  });

  it("jumps from the tier to the tenant and the name when Free is chosen", () => {
    const all = withFreeTier(OFFERS, false);
    let c = choose(EMPTY_CHOICE, { type: "free-db" });
    expect(stepsFor(c)).toEqual(["tier", "tenant", "name"]);
    expect(firstOpenStep(c, all)).toBe("tenant");
    c = choose(c, { tenant: "t1" });
    expect(firstOpenStep(c, all)).toBe("name");
    c = choose(c, { name: "mine" });
    expect(firstOpenStep(c, all)).toBeUndefined();
  });

  it("goes through every step for a paid tier", () => {
    expect(stepsFor(choose(EMPTY_CHOICE, { type: "professional-db" }))).toEqual(STEPS);
  });

  it("lists every tier on offer to any tenant, Free first when it is offered", () => {
    expect(tiersIn(ALL)).toEqual(["free-db", "professional-db", "business-critical", "enterprise-db"]);
    expect(tiersIn(withFreeTier(OFFERS, true))).toEqual(["professional-db", "business-critical", "enterprise-db"]);
  });

  it("offers a tier only to the tenants that have it, and Free to all", () => {
    const tenants = [{ id: "t1" }, { id: "t2" }, { id: "t3" }];
    const offers: Offer[] = [{ ...offer("gcp", "r", "R", "enterprise-db", "8GB", "16GB"), tenantId: "t1" }, FREE_OFFER];
    expect(tenantsOffering(offers, tenants, "enterprise-db")).toEqual([{ id: "t1" }]);
    expect(tenantsOffering(offers, tenants, "free-db")).toEqual(tenants);
    expect(tenantsOffering(offers, tenants, "business-critical")).toEqual([]);
  });

  it("limits the cloud, region and size lists to the chosen tier and tenant", () => {
    const offers: Offer[] = [
      { ...offer("gcp", "us-central1", "Iowa", "professional-db", "4GB", "8GB"), tenantId: "t1" },
      { ...offer("aws", "eu-west-1", "Ireland", "enterprise-db", "8GB", "16GB"), tenantId: "t1" },
      { ...offer("azure", "westeurope", "Netherlands", "professional-db", "4GB", "8GB"), tenantId: "t2" },
    ];
    const ofType = offersFor(offers, "t1").filter((o) => o.type === "professional-db");
    expect(cloudsOf(ofType)).toEqual(["gcp"]);
  });

  it("does not accept a choice that is not offered, even if it is set directly", () => {
    const c: Choice = { ...EMPTY_CHOICE, tenant: "t1", cloud: "gcp", region: "eu-west-1", type: "professional-db" };
    expect(stepDone("region", c, OFFERS)).toBe(false);
    expect(stepDone("cloud", { ...c, cloud: "azure" }, OFFERS)).toBe(false);
    expect(stepDone("tier", { ...c, type: "mystery-db" }, OFFERS)).toBe(false);
    expect(stepDone("size", { ...c, region: "us-central1", size: "99GB|99GB" }, OFFERS)).toBe(false);
  });
  it("needs a valid name: 1 to 30 characters", () => {
    expect(stepDone("name", { ...EMPTY_CHOICE, name: "" }, OFFERS)).toBe(false);
    expect(stepDone("name", { ...EMPTY_CHOICE, name: "  " }, OFFERS)).toBe(false);
    expect(stepDone("name", { ...EMPTY_CHOICE, name: "x".repeat(31) }, OFFERS)).toBe(false);
    expect(stepDone("name", { ...EMPTY_CHOICE, name: "x".repeat(30) }, OFFERS)).toBe(true);
  });
});

describe("createVariables", () => {
  const ready: Choice = { ...EMPTY_CHOICE, tenant: "t1", cloud: "gcp", region: "us-central1", type: "professional-db", size: "16GB|32GB", name: "  orders  " };
  it("sends memory and storage as the chosen pair and the name trimmed", () => {
    expect(createVariables(ready, OFFERS)).toEqual({ input: { tenantId: "t1", cloudProvider: "gcp", region: "us-central1", type: "professional-db", memory: "16GB", storage: "32GB", name: "orders" } });
  });
  it("sends a switch only when it is on", () => {
    expect(createVariables({ ...ready, vectorOptimized: true }, OFFERS)?.input).toMatchObject({ vectorOptimized: true });
    expect(createVariables(ready, OFFERS)?.input).not.toHaveProperty("vectorOptimized");
    expect(createVariables(ready, OFFERS)?.input).not.toHaveProperty("graphAnalyticsPlugin");
  });
  it("sends nothing while a step is open", () => {
    expect(createVariables({ ...ready, size: "" }, OFFERS)).toBeUndefined();
    expect(createVariables({ ...ready, name: "" }, OFFERS)).toBeUndefined();
    expect(createVariables(EMPTY_CHOICE, OFFERS)).toBeUndefined();
  });
});

describe("tierName", () => {
  it("names the tiers Aura has, and shows one it does not know as it is", () => {
    expect(tierName("professional-db")).toBe("AuraDB Professional");
    expect(tierName("enterprise-db")).toBe("AuraDB Virtual Dedicated Cloud");
    expect(tierName("future-db")).toBe("future-db");
  });
});

describe("the vector rule", () => {
  const base: Choice = { ...EMPTY_CHOICE, tenant: "t1", cloud: "gcp", region: "us-central1", type: "professional-db", size: "16GB|32GB", name: "orders", vectorOptimized: true };
  it("turns vector off when a size under 8 GB is chosen, and leaves it on for 8 GB or more", () => {
    expect(choose(base, { size: "4GB|8GB" }).vectorOptimized).toBe(false);
    expect(choose(base, { size: "8GB|16GB" }).vectorOptimized).toBe(true);
    expect(choose(base, { size: "16GB|32GB" }).vectorOptimized).toBe(true);
  });
  it("never sends vector for a size under 8 GB, even if the form says on", () => {
    expect(createVariables({ ...base, size: "4GB|8GB" }, OFFERS)?.input).not.toHaveProperty("vectorOptimized");
  });
});

describe("withFreeTier", () => {
  const paid = OFFERS.filter((o) => o.type !== "free-db");
  it("adds the built-in Free offer when the account has no Free instance, whatever the configurations say", () => {
    expect(withFreeTier(paid, false)).toEqual([...paid, FREE_OFFER]);
    expect(withFreeTier(OFFERS, false).filter((o) => o.type === "free-db")).toEqual([FREE_OFFER]); // not twice
  });
  it("leaves Free out when the account already has one", () => {
    expect(withFreeTier(OFFERS, true).some((o) => o.type === "free-db")).toBe(false);
    expect(withFreeTier(paid, true)).toEqual(paid);
  });
  it("is fixed: GCP europe-west1, 1 GB, no storage, version 5", () => {
    expect(FREE_OFFER).toMatchObject({ cloudProvider: "gcp", region: "europe-west1", type: "free-db", memory: "1GB", storage: "", version: "5" });
  });
  it("shows Free under GCP, Belgium and Tier, with a single 1 GB size, even if the tenant offers no paid tier there", () => {
    const onlyAws = [offer("aws", "eu-west-1", "Ireland (eu-west-1)", "professional-db", "4GB", "8GB")];
    const offers = withFreeTier(onlyAws, false);
    expect(cloudsOf(offers)).toEqual(["aws", "gcp"]);
    expect(regionsOf(offers, "gcp")).toEqual([{ region: "europe-west1", regionName: "Belgium (europe-west1)" }]);
    expect(tiersOf(offers, "gcp", "europe-west1")).toEqual(["free-db"]);
    expect(sizesOf(offers, "gcp", "europe-west1", "free-db").map((x) => `${x.memory}|${x.storage}`)).toEqual(["1GB|"]);
  });
  it("builds a Free create with no storage and no vector", () => {
    const offers = withFreeTier(paid, false);
    const choice: Choice = { ...EMPTY_CHOICE, tenant: "t1", cloud: "gcp", region: "europe-west1", type: "free-db", size: "1GB|", name: "mine", vectorOptimized: true };
    expect(createVariables(choice, offers)?.input).toEqual({ tenantId: "t1", cloudProvider: "gcp", region: "europe-west1", type: "free-db", memory: "1GB", storage: "", name: "mine" });
  });
});
