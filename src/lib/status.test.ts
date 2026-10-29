// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import { KNOWN_STATUSES, STATUS_GROUPS, actionsLocked, statusGroup, statusView } from "./status";

// The 13 statuses the Aura API reports. If Aura adds or renames one, add it here and to status.ts.
const specStatuses = ["running", "paused", "suspended", "creating", "updating", "pausing", "resuming", "suspending", "loading", "restoring", "overwriting", "destroying", "loading failed"];

describe("statusView", () => {
  it("knows exactly the statuses Aura reports", () => {
    expect(specStatuses).toHaveLength(13);
    expect([...KNOWN_STATUSES].sort()).toEqual([...specStatuses].sort());
  });

  it("gives every known status a label, a tone and an icon, so colour is never the only signal", () => {
    for (const status of KNOWN_STATUSES) {
      const view = statusView(status);
      expect(view.label.length).toBeGreaterThan(2);
      expect(view.icon).toBeTruthy();
      expect(view.tone).toBeTruthy();
    }
  });

  it.each([
    ["running", "Running", "ok"],
    ["paused", "Paused", "neutral"],
    ["suspended", "Suspended", "neutral"],
    ["updating", "Updating", "info"],
    ["destroying", "Deleting", "danger"],
    ["loading failed", "Loading failed", "danger"],
  ])("shows %s as %s in the %s tone", (status, label, tone) => {
    expect(statusView(status)).toMatchObject({ label, tone });
  });

  it("shows a status it does not know in its own words, as in progress, instead of hiding it", () => {
    expect(statusView("hibernating")).toEqual({ label: "Hibernating", tone: "info", icon: "spinner" });
  });
});

describe("actionsLocked", () => {
  it("locks only while an instance is in progress", () => {
    expect(actionsLocked("IN_PROGRESS")).toBe(true);
    for (const g of ["READY", "STOPPED", "FAILED"] as const) expect(actionsLocked(g)).toBe(false);
  });
  it("lists every group once", () => {
    expect(STATUS_GROUPS.map((g) => g.key).sort()).toEqual(["FAILED", "IN_PROGRESS", "READY", "STOPPED"]);
  });
});

describe("statusGroup", () => {
  it.each([
    ["running", "READY"],
    ["paused", "STOPPED"],
    ["suspended", "STOPPED"],
    ["loading failed", "FAILED"],
    ["creating", "IN_PROGRESS"],
    ["destroying", "IN_PROGRESS"],
  ])("groups %s as %s", (status, group) => {
    expect(statusGroup(status)).toBe(group);
  });

  it("groups every known status, and treats an unknown one as in progress", () => {
    for (const status of KNOWN_STATUSES) expect(["READY", "STOPPED", "IN_PROGRESS", "FAILED"]).toContain(statusGroup(status));
    expect(statusGroup("hibernating")).toBe("IN_PROGRESS");
  });
});
