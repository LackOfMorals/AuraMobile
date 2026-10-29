// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Adapted from grandstack-web-aura: filters run in memory over the stored instances instead of building a GraphQL where.
import type { InstanceStatusGroup } from "../domain/types";
import { gigabytes } from "./format";

export type SortKey = "name" | "newest" | "status" | "memory";

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name A to Z" },
  { key: "newest", label: "Newest first" },
  { key: "status", label: "Needs attention first" },
  { key: "memory", label: "Largest first" },
];

const GROUPS: InstanceStatusGroup[] = ["READY", "STOPPED", "IN_PROGRESS", "FAILED"];

export interface Filters {
  q: string;
  /** Tenant ids. */
  tenants: string[];
  /** gcp, aws, azure. */
  clouds: string[];
  /** Aura instance types, for example professional-db. */
  tiers: string[];
  statuses: InstanceStatusGroup[];
  /** Include instances that Aura no longer lists. */
  showRemoved: boolean;
  sort: SortKey;
}

export const emptyFilters: Filters = { q: "", tenants: [], clouds: [], tiers: [], statuses: [], showRemoved: false, sort: "name" };

/** Route params: React Native's URLSearchParams is incomplete, so filters travel as a plain object of strings. */
export type FilterParams = Record<string, string | undefined>;

const list = (v: string | undefined) => v?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];

export function parseFilters(params: FilterParams): Filters {
  const sort = params.s as SortKey | undefined;
  return {
    q: params.q ?? "",
    tenants: list(params.t),
    clouds: list(params.c),
    tiers: list(params.tier),
    statuses: list(params.st).filter((s): s is InstanceStatusGroup => GROUPS.includes(s as InstanceStatusGroup)),
    showRemoved: params.rm === "1",
    sort: SORTS.some((s) => s.key === sort) ? (sort as SortKey) : "name",
  };
}

/** Only what differs from the default, so an unfiltered view has no params. */
export function serializeFilters(f: Filters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.q) p.q = f.q;
  if (f.tenants.length) p.t = f.tenants.join(",");
  if (f.clouds.length) p.c = f.clouds.join(",");
  if (f.tiers.length) p.tier = f.tiers.join(",");
  if (f.statuses.length) p.st = f.statuses.join(",");
  if (f.showRemoved) p.rm = "1";
  if (f.sort !== "name") p.s = f.sort;
  return p;
}

/** How many filters are on, for the badge on the Filters button. The sort is not a filter. */
export function activeCount(f: Filters): number {
  return (f.q.trim() ? 1 : 0) + f.tenants.length + f.clouds.length + f.tiers.length + f.statuses.length + (f.showRemoved ? 1 : 0);
}

export type Facet = "tenants" | "clouds" | "tiers" | "statuses";

/** The parts of a stored instance the filters look at. */
export interface Filterable {
  name: string;
  tenantId: string;
  cloudProvider?: string | null;
  tier?: string | null;
  statusGroup: InstanceStatusGroup;
  deletedInAuraAt?: string | null;
}

/**
 * Whether an instance passes the filters. `omit` leaves one facet's own filter out, so that facet's counts say what picking each
 * option would give, keeping all the other filters. Ticking one cloud then still shows how many instances each other cloud would give.
 */
export function matches(i: Filterable, f: Filters, omit?: Facet): boolean {
  if (!f.showRemoved && i.deletedInAuraAt) return false;
  const q = f.q.trim().toLowerCase();
  if (q && !i.name.toLowerCase().includes(q)) return false;
  if (omit !== "tenants" && f.tenants.length && !f.tenants.includes(i.tenantId)) return false;
  if (omit !== "clouds" && f.clouds.length && !(i.cloudProvider && f.clouds.includes(i.cloudProvider))) return false;
  if (omit !== "tiers" && f.tiers.length && !(i.tier && f.tiers.includes(i.tier))) return false;
  if (omit !== "statuses" && f.statuses.length && !f.statuses.includes(i.statusGroup)) return false;
  return true;
}

const FACET_KEY: Record<Facet, (i: Filterable) => string | null | undefined> = {
  tenants: (i) => i.tenantId,
  clouds: (i) => i.cloudProvider,
  tiers: (i) => i.tier,
  statuses: (i) => i.statusGroup,
};

/** How many instances each option of one facet would give, with every other filter kept. */
export function facetCounts(items: readonly Filterable[], f: Filters, facet: Facet): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of items) {
    const key = FACET_KEY[facet](i);
    if (key && matches(i, f, facet)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const ATTENTION_RANK: Record<InstanceStatusGroup, number> = { FAILED: 0, IN_PROGRESS: 1, STOPPED: 2, READY: 3 };

interface Sortable {
  name: string;
  createdAt?: string | null;
  statusGroup: InstanceStatusGroup;
  memory?: string | null;
}

const byName = (a: Sortable, b: Sortable) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/**
 * Memory is text ("16GB" sorts before "2GB" as a string), so it is compared as a number.
 * Ties and missing values fall back to the name, so the order is always the same.
 */
export function sortInstances<T extends Sortable>(items: readonly T[], key: SortKey): T[] {
  const copy = [...items];
  switch (key) {
    case "name":
      return copy.sort(byName);
    case "newest":
      return copy.sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) || byName(a, b));
    case "status":
      return copy.sort((a, b) => ATTENTION_RANK[a.statusGroup] - ATTENTION_RANK[b.statusGroup] || byName(a, b));
    case "memory":
      return copy.sort((a, b) => {
        const [x, y] = [gigabytes(a.memory), gigabytes(b.memory)];
        if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1;
        return (Number.isNaN(x) ? 0 : y - x) || byName(a, b);
      });
  }
}
