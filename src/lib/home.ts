import { tierName } from "./create";
import { sortInstances, type Filterable } from "./filters";

export interface Tag {
  /** The value to filter by: a tenant id, a cloud or a tier type. */
  value: string;
  label: string;
  count: number;
}

export interface HomeSummary<T extends HomeInstance = HomeInstance> {
  total: number;
  tenants: Tag[];
  clouds: Tag[];
  tiers: Tag[];
  running: T[];
  /** Being created, resized, paused or resumed: shown so a new instance is visible on Home straight away. */
  inProgress: T[];
}

export type HomeInstance = Filterable & { createdAt?: string | null; memory?: string | null };

function tags(counts: Map<string, number>, label: (value: string) => string): Tag[] {
  return [...counts]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const bump = (counts: Map<string, number>, key: string | null | undefined) => {
  if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
};

/**
 * What the home screen shows, from the stored instances. Instances Aura no longer lists are left out.
 * Tags with no instances never appear, and a tenant with no name falls back to its id.
 */
export function summarize<T extends HomeInstance>(instances: readonly T[], tenantNames: ReadonlyMap<string, string>, cloudLabel: (c: string) => string): HomeSummary<T> {
  const live = instances.filter((i) => !i.deletedInAuraAt);
  const tenants = new Map<string, number>();
  const clouds = new Map<string, number>();
  const tiers = new Map<string, number>();
  for (const i of live) {
    bump(tenants, i.tenantId);
    bump(clouds, i.cloudProvider);
    bump(tiers, i.tier);
  }
  return {
    total: live.length,
    tenants: tags(tenants, (id) => tenantNames.get(id) ?? id),
    clouds: tags(clouds, cloudLabel),
    tiers: tags(tiers, tierName),
    running: sortInstances(live.filter((i) => i.statusGroup === "READY"), "name"),
    inProgress: sortInstances(live.filter((i) => i.statusGroup === "IN_PROGRESS"), "name"),
  };
}
