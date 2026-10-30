import { cloudLabel } from "./format";
import { HomeInstance, summarize } from "./home";

const inst = (name: string, over: Partial<HomeInstance> = {}): HomeInstance => ({
  name, tenantId: "t1", cloudProvider: "gcp", tier: "professional-db", statusGroup: "READY", deletedInAuraAt: null, ...over,
});
const names = new Map([["t1", "Prod"], ["t2", "Sandbox"]]);

describe("summarize", () => {
  const list = [
    inst("a"), inst("b"), inst("c", { cloudProvider: "aws", tenantId: "t2" }),
    inst("failed", { statusGroup: "FAILED" }), inst("busy", { statusGroup: "IN_PROGRESS" }), inst("off", { statusGroup: "STOPPED", tier: "free-db" }),
    inst("gone", { deletedInAuraAt: "2026-01-01T00:00:00Z" }),
  ];
  const s = summarize(list, names, cloudLabel);

  it("leaves out instances Aura no longer lists", () => {
    expect(s.total).toBe(6);
    expect(s.running.some((i) => i.name === "gone")).toBe(false);
  });

  it("counts tags, biggest first, with readable labels", () => {
    expect(s.tenants).toEqual([{ value: "t1", label: "Prod", count: 5 }, { value: "t2", label: "Sandbox", count: 1 }]);
    expect(s.clouds[0]).toEqual({ value: "gcp", label: "GCP", count: 5 });
    expect(s.tiers.map((t) => t.label)).toEqual(["AuraDB Professional", "AuraDB Free"]);
  });

  it("falls back to the id for a tenant with no name", () => {
    expect(summarize([inst("a", { tenantId: "unknown" })], names, cloudLabel).tenants[0]!.label).toBe("unknown");
  });

  it("has no grouping for failed or stopped instances: they are found through the instance list", () => {
    expect(Object.keys(s).sort()).toEqual(["clouds", "inProgress", "running", "tenants", "tiers", "total"]);
    expect(s.total).toBe(6); // failed, changing and stopped instances still count
  });

  it("lists instances that are being created or changed, so a new instance shows on Home", () => {
    expect(s.inProgress.map((i) => i.name)).toEqual(["busy"]);
    expect(s.running.some((i) => i.name === "busy")).toBe(false);
  });

  it("lists only ready instances as running, by name", () => {
    expect(s.running.map((i) => i.name)).toEqual(["a", "b", "c"]);
  });

  it("handles no instances", () => {
    expect(summarize([], names, cloudLabel)).toEqual({ total: 0, tenants: [], clouds: [], tiers: [], running: [], inProgress: [] });
  });
});
