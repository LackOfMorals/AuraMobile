import { MockAura } from "./mock";

describe("MockAura", () => {
  it("lists the demo instances with tenants and configurations", async () => {
    const aura = new MockAura();
    expect((await aura.listInstances()).length).toBeGreaterThan(2);
    expect((await aura.listInstances("demo-tenant-2")).every((i) => i.tenant_id === "demo-tenant-2")).toBe(true);
    expect((await aura.getTenant("demo-tenant-1")).instance_configurations.length).toBeGreaterThan(0);
  });

  it("shows pausing once, then paused", async () => {
    const aura = new MockAura();
    await aura.pauseInstance("d0000001");
    expect((await aura.getInstance("d0000001")).status).toBe("pausing");
    expect((await aura.getInstance("d0000001")).status).toBe("paused");
  });

  it("creates an instance, returning its password once", async () => {
    const aura = new MockAura();
    const created = await aura.createInstance({ version: "5", region: "eu-west-1", memory: "4GB", storage: "16GB", name: "new-one", type: "professional-db", tenant_id: "demo-tenant-1", cloud_provider: "aws" });
    expect(created.password).toBeTruthy();
    expect((await aura.getInstance(created.id)).status).toBe("creating");
    expect((await aura.getInstance(created.id)).status).toBe("running");
    expect((await aura.getInstance(created.id)) as object).not.toHaveProperty("password");
  });

  it("deletes through destroying, then the instance is gone", async () => {
    const aura = new MockAura();
    await aura.deleteInstance("d0000002");
    expect((await aura.getInstance("d0000002")).status).toBe("destroying");
    await expect(aura.getInstance("d0000002")).rejects.toMatchObject({ status: 404 });
  });

  it("applies updates and rejects unknown ids", async () => {
    const aura = new MockAura();
    await aura.updateInstance("d0000001", { name: "renamed" });
    expect((await aura.getInstance("d0000001")).name).toBe("renamed");
    await expect(aura.pauseInstance("nope")).rejects.toMatchObject({ status: 404 });
  });
});
