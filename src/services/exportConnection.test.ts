import { APP_NAME } from "../appName";
import { exportConnection, type ExportDeps } from "./exportConnection";

const instance = { auraId: "d0000001", name: "orders-prod", connectionUrl: "neo4j+s://d0000001.databases.neo4j.io" };
const login = { username: "neo4j", password: "s3cretPassw0rd" };

function setup(over: Partial<ExportDeps> = {}) {
  const calls: string[] = [];
  const written: { filename: string; contents: string }[] = [];
  const deps: ExportDeps = {
    reveal: async () => { calls.push("reveal"); return login; },
    saveText: async (filename, contents) => { calls.push("save"); written.push({ filename, contents }); return { saved: true, name: filename }; },
    recordExport: async () => { calls.push("record"); },
    now: () => new Date("2026-10-30T12:00:00.000Z"),
    ...over,
  };
  return { deps, calls, written };
}

describe("exportConnection", () => {
  it("asks for Face ID first, then writes the file, then counts it", async () => {
    const { deps, calls } = setup();
    expect(await exportConnection(deps, instance)).toEqual({ kind: "saved", name: `${APP_NAME}-orders-prod-d0000001-connection.txt` });
    expect(calls).toEqual(["reveal", "save", "record"]);
  });

  it("puts the connection details in the file and the password nowhere else", async () => {
    const { deps, written } = setup();
    await exportConnection(deps, instance);
    expect(written).toHaveLength(1);
    expect(written[0]!.contents).toContain("NEO4J_PASSWORD=s3cretPassw0rd");
    expect(written[0]!.contents).toContain("NEO4J_URI=neo4j+s://d0000001.databases.neo4j.io");
    expect(written[0]!.filename).not.toContain("s3cretPassw0rd");
  });

  it("writes nothing and counts nothing if Face ID is cancelled or no password is stored", async () => {
    const { deps, calls } = setup({ reveal: async () => null });
    expect(await exportConnection(deps, instance)).toEqual({ kind: "not-unlocked" });
    expect(calls).toEqual([]);
  });

  it("does not even ask for Face ID when there is no address to save", async () => {
    const { deps, calls } = setup();
    const result = await exportConnection(deps, { ...instance, connectionUrl: null });
    expect(result.kind).toBe("unavailable");
    expect(calls).toEqual([]);
  });

  it("does not count a save the person cancelled", async () => {
    const { deps, calls } = setup({ saveText: async () => ({ saved: false }) });
    expect(await exportConnection(deps, instance)).toEqual({ kind: "cancelled" });
    expect(calls).not.toContain("record");
  });

  it("reports a failure to save in plain words, without the password, and does not count it", async () => {
    for (const saveText of [async () => ({ saved: false, error: "disk full" }), async () => { throw new Error("boom " + login.password); }]) {
      const { deps, calls } = setup({ saveText });
      const result = await exportConnection(deps, instance);
      expect(result.kind).toBe("failed");
      expect(JSON.stringify(result)).not.toContain(login.password);
      expect(calls).not.toContain("record");
    }
  });

  it("still says it was saved if counting the export fails", async () => {
    const { deps } = setup({ recordExport: async () => { throw new Error("db"); } });
    expect((await exportConnection(deps, instance)).kind).toBe("saved");
  });

  it("never gives the password to the audit trail", async () => {
    const seen: unknown[] = [];
    const { deps } = setup({ recordExport: async (...args: unknown[]) => { seen.push(...args); } });
    await exportConnection(deps, instance);
    expect(JSON.stringify(seen)).not.toContain(login.password);
    expect(seen).toEqual(["d0000001"]);
  });
});
