import { AuraApiError } from "../../aura/client";
import { MockAura } from "../../aura/mock";
import { UserError } from "../errors";
import { OperationService } from "./service";
import { FakeVault, MemoryOperationStore, storedInstance } from "./testing";

function setup(instances = [storedInstance()], opts: { timeoutMs?: number; onProgress?: () => void } = {}) {
  const aura = new MockAura();
  const store = new MemoryOperationStore(instances);
  const vault = new FakeVault();
  let clock = Date.parse("2026-10-30T09:00:00Z");
  const service = new OperationService({
    store,
    vault,
    client: () => aura,
    isConnected: async () => true,
    now: () => new Date(clock),
    sleep: async (ms) => {
      clock += ms;
    },
    pollDelayMs: () => 400,
    timeoutMs: opts.timeoutMs ?? 60_000,
    onProgress: opts.onProgress,
  });
  return { aura, store, vault, service };
}

const spy = <T extends object>(obj: T, method: keyof T) => jest.spyOn(obj as never, method as never);
const op = (s: ReturnType<typeof setup>, id: string) => s.store.operations.get(id)!;

describe("planning", () => {
  it("plans a pause without contacting Aura, and shows what will change", async () => {
    const s = setup();
    const pause = spy(s.aura, "pauseInstance");
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    expect(pause).not.toHaveBeenCalled();
    expect(op(s, operationId).status).toBe("PLANNED");
    expect(op(s, operationId).plan.items).toEqual([{ field: "state", label: "State", before: "Running", after: "Paused" }]);
    expect(op(s, operationId).plan.warnings[0]).toMatch(/cannot be used/);
  });

  it.each([
    ["an unknown instance", () => setup([]), "PAUSE", /not in the store/],
    ["an instance Aura no longer lists", () => setup([storedInstance({ deletedInAuraAt: "2026-01-01T00:00:00Z" })]), "PAUSE", /no longer in Aura/],
    ["an instance Aura is working on", () => setup([storedInstance({ status: "updating", statusGroup: "IN_PROGRESS" })]), "PAUSE", /working on this instance/],
    ["pausing a paused instance", () => setup([storedInstance({ status: "paused", statusGroup: "STOPPED" })]), "PAUSE", /Only a running instance can be paused/],
    ["resuming a running instance", () => setup(), "RESUME", /Only a paused instance can be resumed/],
    ["editing a paused instance", () => setup([storedInstance({ status: "paused", statusGroup: "STOPPED" })]), "UPDATE", /Resume this instance first/],
  ] as const)("refuses %s", async (_name, make, kind, message) => {
    const s = make();
    await expect(s.service.plan(kind, "d0000001", { name: "x" })).rejects.toThrow(message);
  });

  it("refuses a second change while one holds the instance", async () => {
    const s = setup();
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await expect(s.service.plan("PAUSE", "d0000001")).rejects.toThrow(/already in progress/);
    await s.service.idle();
  });

  it("plans an edit with only what differs, and refuses an empty or unoffered one", async () => {
    const s = setup();
    const { operationId } = await s.service.plan("UPDATE", "d0000001", { name: " renamed ", memory: "4GB", storage: "16GB", vectorOptimized: false, graphAnalyticsPlugin: false });
    expect(op(s, operationId).desired.changes).toEqual({ name: "renamed", memory: "4GB", storage: "16GB", vectorOptimized: false }); // analytics already off: not sent
    expect(op(s, operationId).plan.warnings[0]).toMatch(/smaller size/);
    await expect(s.service.plan("UPDATE", "d0000001", { name: "orders-prod" })).rejects.toThrow("Nothing would change.");
    await expect(s.service.plan("UPDATE", "d0000001", { memory: "64GB", storage: "1GB" })).rejects.toThrow(/not offered/);
    await expect(s.service.plan("UPDATE", "d0000001", { memory: "4GB" })).rejects.toThrow(/chosen together/);
    await expect(s.service.plan("UPDATE", "d0000001", { name: "  " })).rejects.toThrow(/cannot be empty/);
    await expect(s.service.plan("UPDATE", "d0000001", { name: "x".repeat(31) })).rejects.toThrow(/at most 30/);
  });
});

describe("the vector rule in the engine", () => {
  it("refuses to plan vector on at under 8 GB, for an edit and for a create", async () => {
    const s = setup([storedInstance({ memory: "4GB", storage: "16GB", vectorOptimized: false })]);
    await expect(s.service.plan("UPDATE", "d0000001", { vectorOptimized: true })).rejects.toThrow(/8 GB or more of memory/);
    await expect(s.service.planCreate({ tenantId: "demo-tenant-1", cloudProvider: "aws", region: "eu-west-1", type: "professional-db", memory: "4GB", name: "x", vectorOptimized: true })).rejects.toThrow(/8 GB or more of memory/);
  });

  it("refuses shrinking under 8 GB while vector stays on, but allows it if vector is turned off too", async () => {
    const s = setup();
    await expect(s.service.plan("UPDATE", "d0000001", { memory: "4GB", storage: "16GB" })).rejects.toThrow(/Turn vector optimisation off/);
    const { operationId } = await s.service.plan("UPDATE", "d0000001", { memory: "4GB", storage: "16GB", vectorOptimized: false });
    expect(op(s, operationId).desired.changes).toMatchObject({ memory: "4GB", vectorOptimized: false });
  });

  it("allows vector at 8 GB", async () => {
    const s = setup([storedInstance({ vectorOptimized: false })]);
    await expect(s.service.plan("UPDATE", "d0000001", { vectorOptimized: true })).resolves.toBeDefined();
  });
});

describe("confirming and running", () => {
  it("sends a pause once, watches until paused, updates the stored copy and finishes every step", async () => {
    const s = setup();
    const pause = spy(s.aura, "pauseInstance");
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(op(s, operationId).status).toBe("SUCCEEDED");
    expect(op(s, operationId).steps.map((x) => x.status)).toEqual(Array(6).fill("DONE"));
    expect((await s.store.loadInstance("d0000001"))!.status).toBe("paused");
  });

  it("renames an instance and waits until Aura shows the new name", async () => {
    const s = setup();
    const { operationId } = await s.service.plan("UPDATE", "d0000001", { name: "orders-live" });
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
    expect((await s.store.loadInstance("d0000001"))!.name).toBe("orders-live");
  });

  it("only lets one of two simultaneous confirmations through, so Aura is asked once", async () => {
    const s = setup();
    const pause = spy(s.aura, "pauseInstance");
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    const results = await Promise.allSettled([s.service.confirm(operationId), s.service.confirm(operationId)]);
    await s.service.idle();
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("lets only one of two separate services through, decided by the store and not by either one's own memory", async () => {
    const s = setup();
    const other = new OperationService({ store: s.store, vault: s.vault, client: () => s.aura, isConnected: async () => true, sleep: async () => undefined, pollDelayMs: () => 0 });
    const pause = spy(s.aura, "pauseInstance");
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    const results = await Promise.allSettled([s.service.confirm(operationId), other.confirm(operationId)]);
    await Promise.all([s.service.idle(), other.idle()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("will not confirm twice in a row", async () => {
    const s = setup();
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    await expect(s.service.confirm(operationId)).rejects.toThrow(/already confirmed/);
  });

  it("refuses to confirm a plan that is no longer true, and does not contact Aura", async () => {
    const s = setup();
    const pause = spy(s.aura, "pauseInstance");
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    s.store.instances.get("d0000001")!.name = "renamed-elsewhere"; // a sync changed it
    await expect(s.service.confirm(operationId)).rejects.toThrow(/changed after you planned/);
    expect(pause).not.toHaveBeenCalled();
    expect(op(s, operationId).status).toBe("PLANNED");
  });

  it("needs a connected account", async () => {
    const s = setup();
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    const offline = new OperationService({ store: s.store, vault: s.vault, client: () => s.aura, isConnected: async () => false });
    await expect(offline.confirm(operationId)).rejects.toThrow(/Connect an Aura account/);
  });

  it("can cancel a plan, but not one already sent", async () => {
    const s = setup();
    const first = await s.service.plan("PAUSE", "d0000001");
    await s.service.cancel(first.operationId);
    expect(op(s, first.operationId).status).toBe("CANCELLED");
    await expect(s.service.confirm(first.operationId)).rejects.toThrow(/cancelled/);
    const second = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(second.operationId);
    await expect(s.service.cancel(second.operationId)).rejects.toThrow(/already been sent/);
    await s.service.idle();
  });
});

describe("watching Aura while it works", () => {
  it("saves each status Aura reports as it reports it, and tells the screens each time", async () => {
    const seen: string[] = [];
    let store!: MemoryOperationStore;
    const s = setup([storedInstance()], { onProgress: () => seen.push(store.instances.get("d0000001")!.status) });
    store = s.store;
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(seen).toEqual(["pausing", "paused"]);
    expect(op(s, operationId).status).toBe("SUCCEEDED");
  });

  it("shows a created instance as creating, then running, while it waits", async () => {
    const seen: string[] = [];
    let store!: MemoryOperationStore;
    const s = setup([storedInstance()], { onProgress: () => seen.push(store.instances.get("d0000005")!.status) });
    store = s.store;
    const { operationId } = await s.service.planCreate({ tenantId: "demo-tenant-1", cloudProvider: "aws", region: "eu-west-1", type: "professional-db", memory: "4GB", name: "fresh" });
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(seen).toEqual(["creating", "running"]);
  });

  it("carries on, and still finishes, if saving a status fails along the way", async () => {
    const s = setup();
    const real = s.store.refreshInstance.bind(s.store);
    let first = true;
    s.store.refreshInstance = async (d, at) => {
      if (first) {
        first = false;
        throw new Error("disk busy");
      }
      return real(d, at);
    };
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
    expect(s.store.instances.get("d0000001")!.status).toBe("paused");
  });

  it("looks every few seconds at first, and never waits longer than ten", () => {
    const { defaultPollDelay } = jest.requireActual("./run");
    expect(defaultPollDelay(0)).toBe(3000);
    expect(defaultPollDelay(1)).toBe(4200);
    expect(defaultPollDelay(5)).toBe(10_000);
    expect(defaultPollDelay(50)).toBe(10_000);
  });
});

describe("failures", () => {
  it("records Aura's refusal in plain words and fails the sending step", async () => {
    const s = setup();
    s.aura.pauseInstance = async () => {
      throw new AuraApiError(409, [{ message: "busy" }]);
    };
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toMatch(/already working on this instance/);
    expect(op(s, operationId).steps.find((x) => x.seq === 2)!.status).toBe("FAILED");
  });

  it("says it is not known whether Aura got the request when contact is lost while sending", async () => {
    const s = setup();
    const { AuraUnreachableError } = jest.requireActual("../../aura/client");
    s.aura.pauseInstance = async () => {
      throw new AuraUnreachableError();
    };
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).error).toMatch(/not known whether Aura received it/);
  });

  it("fails when Aura reports 'loading failed'", async () => {
    const s = setup();
    const real = s.aura.getInstance.bind(s.aura);
    s.aura.getInstance = async (id) => ({ ...(await real(id)), status: "loading failed" });
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toMatch(/loading failed/);
  });

  it("gives up waiting after the timeout, and says the change may still finish", async () => {
    const s = setup([storedInstance()], { timeoutMs: 1000 });
    const real = s.aura.getInstance.bind(s.aura);
    s.aura.getInstance = async (id) => ({ ...(await real(id)), status: "pausing" });
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toMatch(/may still finish/);
  });

  it("carries on through a brief loss of contact while waiting", async () => {
    const s = setup();
    const { AuraUnreachableError } = jest.requireActual("../../aura/client");
    const real = s.aura.getInstance.bind(s.aura);
    let calls = 0;
    s.aura.getInstance = async (id) => {
      if (++calls <= 2) throw new AuraUnreachableError();
      return real(id);
    };
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
  });
});

describe("delete", () => {
  it("is only confirmed when the exact name is typed, and never contacts Aura before that", async () => {
    const s = setup();
    const del = spy(s.aura, "deleteInstance");
    const { operationId } = await s.service.planDelete("d0000001");
    expect(op(s, operationId).plan.warnings[0]).toMatch(/cannot be undone/);
    await expect(s.service.confirm(operationId)).rejects.toThrow(/Type the instance's name exactly/);
    await expect(s.service.confirm(operationId, "orders-pro")).rejects.toThrow(UserError);
    await expect(s.service.confirm(operationId, "ORDERS-PROD")).rejects.toThrow(UserError);
    expect(del).not.toHaveBeenCalled();
    await s.service.confirm(operationId, "orders-prod");
    await s.service.idle();
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("marks the instance gone and removes its stored password", async () => {
    const s = setup();
    const { operationId } = await s.service.planDelete("d0000001");
    await s.service.confirm(operationId, "orders-prod");
    await s.service.idle();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
    expect(s.store.instances.get("d0000001")!.deletedInAuraAt).not.toBeNull();
    expect(s.vault.calls).toContain("delete:d0000001");
  });

  it("counts deleting what Aura already lacks as done", async () => {
    const s = setup();
    s.aura.deleteInstance = async () => {
      throw new AuraApiError(404, [{ message: "gone" }]);
    };
    s.aura.getInstance = async () => {
      throw new AuraApiError(404, [{ message: "gone" }]);
    };
    const { operationId } = await s.service.planDelete("d0000001");
    await s.service.confirm(operationId, "orders-prod");
    await s.service.idle();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
  });
});

describe("create", () => {
  const input = { tenantId: "demo-tenant-1", cloudProvider: "aws", region: "eu-west-1", type: "professional-db", memory: "4GB", name: " fresh " };

  it("refuses a combination the tenant is not offered", async () => {
    const s = setup();
    await expect(s.service.planCreate({ ...input, memory: "128GB" })).rejects.toThrow(/not offered/);
    await expect(s.service.planCreate({ ...input, tenantId: "nope" })).rejects.toThrow(/not in the store/);
    await expect(s.service.planCreate({ ...input, name: "" })).rejects.toThrow(/cannot be empty/);
  });

  it("creates once, stores the password before recording anything, and finishes", async () => {
    const s = setup();
    const create = spy(s.aura, "createInstance");
    const { operationId } = await s.service.planCreate(input);
    expect(create).not.toHaveBeenCalled();
    expect(op(s, operationId).plan.warnings[0]).toMatch(/billed/);
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toMatchObject({ name: "fresh", storage: "16GB", version: "5", tenant_id: "demo-tenant-1", cloud_provider: "aws" });
    expect(op(s, operationId).status).toBe("SUCCEEDED");
    expect(s.vault.calls).toEqual(["save:d0000005", "link:d0000005"]);
    expect(s.vault.passwords.get("d0000005")).toBe("demo-password-shown-once");
    expect((await s.store.loadInstance("d0000005"))!.status).toBe("running");
  });

  it("creates AuraDB Free from the built-in offer: GCP europe-west1, 1 GB, no storage, even though no configuration lists it", async () => {
    const s = setup();
    expect(s.store.offered.some((o) => o.type === "free-db")).toBe(false);
    const create = spy(s.aura, "createInstance");
    const { operationId } = await s.service.planCreate({ tenantId: "demo-tenant-1", cloudProvider: "gcp", region: "europe-west1", type: "free-db", memory: "1GB", storage: "", name: "free-one" });
    expect(op(s, operationId).plan.items.map((i) => i.label)).not.toContain("Storage");
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(create.mock.calls[0]![0]).toEqual({ version: "5", region: "europe-west1", memory: "1GB", name: "free-one", type: "free-db", tenant_id: "demo-tenant-1", cloud_provider: "gcp" });
    expect(op(s, operationId).status).toBe("SUCCEEDED");
  });

  it("refuses a second Free instance, and does not contact Aura", async () => {
    const s = setup([storedInstance({ auraId: "free1", tier: "free-db", memory: "1GB", storage: null })]);
    const create = spy(s.aura, "createInstance");
    await expect(s.service.planCreate({ tenantId: "demo-tenant-1", cloudProvider: "gcp", region: "europe-west1", type: "free-db", memory: "1GB", storage: "", name: "second" })).rejects.toThrow(/not offered/);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows Free again once the old Free instance is gone from Aura", async () => {
    const s = setup([storedInstance({ auraId: "free1", tier: "free-db", memory: "1GB", storage: null, deletedInAuraAt: "2026-01-01T00:00:00Z" })]);
    await expect(s.service.planCreate({ tenantId: "demo-tenant-1", cloudProvider: "gcp", region: "europe-west1", type: "free-db", memory: "1GB", storage: "", name: "again" })).resolves.toBeDefined();
  });

  it("shows every field Aura says is wrong when it refuses a create", async () => {
    const s = setup();
    s.aura.createInstance = async () => {
      throw new AuraApiError(400, [
        { message: "request body contains validation errors" },
        { message: "must be one of the offered sizes", field: "memory", reason: "invalid-value", detail: '{"allowed":["4GB"]}' },
      ]);
    };
    const { operationId } = await s.service.planCreate(input);
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toContain("field: memory");
    expect(op(s, operationId).error).toContain("reason: invalid-value");
    expect(op(s, operationId).error).toContain('{"allowed":["4GB"]}');
  });

  it("fails loudly, naming the instance, if the password cannot be stored", async () => {
    const s = setup();
    s.vault.failSave = true;
    const { operationId } = await s.service.planCreate(input);
    await s.service.confirm(operationId);
    await s.service.idle();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toMatch(/d0000005.*could not store its password/);
  });
});

describe("recovering after a restart", () => {
  async function interrupted(stepTwo: "PENDING" | "ACTIVE" | "DONE", mutate?: (s: ReturnType<typeof setup>) => void) {
    const s = setup();
    const { operationId } = await s.service.plan("PAUSE", "d0000001");
    // Reach the state a crash would leave: confirmed, steps made, and step 2 as given
    await s.store.moveOperation(operationId, "PLANNED", "CONFIRMED", {}, "t");
    await s.store.addSteps(operationId, [1, 2, 3, 4, 5, 6].map((seq) => ({ seq, label: `s${seq}`, status: seq === 1 ? ("DONE" as const) : ("PENDING" as const) })));
    if (stepTwo !== "PENDING") await s.store.setStep(operationId, 2, stepTwo, "t");
    if (stepTwo === "DONE") {
      await s.store.moveOperation(operationId, "CONFIRMED", "RUNNING", {}, "t");
      await s.store.setStep(operationId, 3, "DONE", "t");
    }
    mutate?.(s);
    return { s, operationId };
  }

  it("runs an operation that was never sent", async () => {
    const { s, operationId } = await interrupted("PENDING");
    const pause = spy(s.aura, "pauseInstance");
    expect(await s.service.recover()).toBe(1);
    await s.service.idle();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(op(s, operationId).status).toBe("SUCCEEDED");
  });

  it("only watches an operation that was already sent and answered, never sending again", async () => {
    const { s, operationId } = await interrupted("DONE");
    await s.aura.pauseInstance("d0000001"); // Aura got it before the crash
    const pause = spy(s.aura, "pauseInstance");
    await s.service.recover();
    await s.service.idle();
    expect(pause).not.toHaveBeenCalled();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
  });

  it("records success without sending again when a possibly-sent change already shows in Aura", async () => {
    const { s, operationId } = await interrupted("ACTIVE", (x) => {
      x.aura["instances"].find((i) => i.id === "d0000001")!.status = "paused";
    });
    const pause = spy(s.aura, "pauseInstance");
    await s.service.recover();
    await s.service.idle();
    expect(pause).not.toHaveBeenCalled();
    expect(op(s, operationId).status).toBe("SUCCEEDED");
    expect((await s.store.loadInstance("d0000001"))!.status).toBe("paused");
  });

  it("fails a possibly-sent change that Aura does not show, rather than asking Aura a second time", async () => {
    const { s, operationId } = await interrupted("ACTIVE");
    const pause = spy(s.aura, "pauseInstance");
    await s.service.recover();
    await s.service.idle();
    expect(pause).not.toHaveBeenCalled();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toMatch(/not known whether Aura received it/);
  });

  it("fails a create that may have been sent but was never recorded, without asking again", async () => {
    const s = setup();
    const { operationId } = await s.service.planCreate({ tenantId: "demo-tenant-1", cloudProvider: "aws", region: "eu-west-1", type: "professional-db", memory: "4GB", name: "fresh" });
    await s.store.moveOperation(operationId, "PLANNED", "CONFIRMED", {}, "t");
    await s.store.addSteps(operationId, [1, 2, 3, 4, 5, 6].map((seq) => ({ seq, label: `s${seq}`, status: seq === 1 ? ("DONE" as const) : ("PENDING" as const) })));
    await s.store.setStep(operationId, 2, "ACTIVE", "t");
    const create = spy(s.aura, "createInstance");
    await s.service.recover();
    await s.service.idle();
    expect(create).not.toHaveBeenCalled();
    expect(op(s, operationId).status).toBe("FAILED");
    expect(op(s, operationId).error).toMatch(/Nothing was asked of Aura a second time/);
  });
});
