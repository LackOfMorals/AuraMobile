// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import type { CreateVariables } from "../domain/types";
import { nameError, sizeKey, sizeOptions, vectorAllowed, type SizeOption } from "./changes";

/**
 * One combination that can be created. Every list in the create form is derived from these, so an invalid request cannot be built.
 * `tenantId` says which tenant is offered it; an offer with none (AuraDB Free) is open to every tenant.
 */
export interface Offer {
  tenantId?: string;
  cloudProvider: string;
  region: string;
  regionName: string;
  type: string;
  memory: string;
  storage: string;
  version: string;
}

export interface Choice {
  tenant: string;
  cloud: string;
  region: string;
  type: string;
  /** sizeKey of the chosen memory and storage pair. */
  size: string;
  name: string;
  vectorOptimized: boolean;
  graphAnalyticsPlugin: boolean;
}

export const EMPTY_CHOICE: Choice = { tenant: "", cloud: "", region: "", type: "", size: "", name: "", vectorOptimized: false, graphAnalyticsPlugin: false };

/**
 * The steps, one decision each. The tier comes first because it decides what the rest can be: which tenants offer it, and, for
 * AuraDB Free, everything else.
 */
export const STEPS = ["tier", "tenant", "cloud", "region", "size", "name"] as const;
export type Step = (typeof STEPS)[number];

export const STEP_TITLE: Record<Step, string> = {
  tier: "Which tier?",
  tenant: "Which tenant?",
  cloud: "Which cloud?",
  region: "Which region?",
  size: "How big?",
  name: "Name it",
};

/** Names for the tiers. The store only knows the tiers an instance already uses, so a tier nobody has yet needs a name here. */
const TIER_LABELS: Record<string, string> = {
  "free-db": "AuraDB Free",
  "professional-db": "AuraDB Professional",
  "business-critical": "AuraDB Business Critical",
  "enterprise-db": "AuraDB Virtual Dedicated Cloud",
  "professional-ds": "AuraDS Professional",
  "enterprise-ds": "AuraDS Enterprise",
};
export const tierName = (type: string): string => TIER_LABELS[type] ?? type;

const TIER_ORDER = ["free-db", "professional-db", "business-critical", "enterprise-db", "professional-ds", "enterprise-ds"];
const tierRank = (t: string) => (TIER_ORDER.includes(t) ? TIER_ORDER.indexOf(t) : TIER_ORDER.length);

const unique = <T>(items: T[]): T[] => [...new Set(items)];

/**
 * AuraDB Free is not in a tenant's configurations, which list only what paid instances can use. It has one fixed shape:
 * GCP europe-west1, 1 GB, no storage, Neo4j 5. There is nothing to choose.
 */
export const FREE_OFFER: Offer = {
  cloudProvider: "gcp",
  region: "europe-west1",
  regionName: "Belgium (europe-west1)",
  type: "free-db",
  memory: "1GB",
  storage: "",
  version: "5",
};

export const isFree = (type: string): boolean => type === FREE_OFFER.type;

/**
 * What can be created: the tenants' configurations, plus AuraDB Free unless the account already has a Free instance (Aura allows one).
 * Any Free entry in the configurations is replaced by the built-in one, so there is exactly one way to ask for Free.
 */
export function withFreeTier<T extends Offer>(offers: readonly T[], hasFreeInstance: boolean): (T | Offer)[] {
  const paid = offers.filter((o) => o.type !== "free-db");
  return hasFreeInstance ? paid : [...paid, FREE_OFFER];
}

/** The offers open to one tenant: its own, and those that belong to no tenant. */
export const offersFor = (offers: readonly Offer[], tenant: string): Offer[] => offers.filter((o) => !o.tenantId || o.tenantId === tenant);

/** Every tier on offer to any tenant, cheapest kind first. This is the first question, so it spans all tenants. */
export function tiersIn(offers: readonly Offer[]): string[] {
  return unique(offers.map((o) => o.type)).sort((a, b) => tierRank(a) - tierRank(b) || a.localeCompare(b));
}

/** The tenants that can create a tier. Free belongs to no tenant, so every tenant can. */
export function tenantsOffering<T extends { id: string }>(offers: readonly Offer[], tenants: readonly T[], type: string): T[] {
  return tenants.filter((t) => offers.some((o) => o.type === type && (!o.tenantId || o.tenantId === t.id)));
}

export const cloudsOf = (offers: readonly Offer[]): string[] => unique(offers.map((o) => o.cloudProvider)).sort();

export function regionsOf(offers: readonly Offer[], cloud: string): { region: string; regionName: string }[] {
  const byRegion = new Map(offers.filter((o) => o.cloudProvider === cloud).map((o) => [o.region, o.regionName]));
  return [...byRegion].map(([region, regionName]) => ({ region, regionName })).sort((a, b) => a.regionName.localeCompare(b.regionName));
}

export function tiersOf(offers: readonly Offer[], cloud: string, region: string): string[] {
  return tiersIn(offers.filter((o) => o.cloudProvider === cloud && o.region === region));
}

export function sizesOf(offers: readonly Offer[], cloud: string, region: string, type: string): SizeOption[] {
  return sizeOptions(offers.filter((o) => o.cloudProvider === cloud && o.region === region && o.type === type));
}

/** The steps this choice needs. AuraDB Free fixes cloud, region and size, so only the tier, the tenant and the name are left. */
export function stepsFor(c: Choice): readonly Step[] {
  return isFree(c.type) ? (["tier", "tenant", "name"] as const) : STEPS;
}

/**
 * Changes one choice and clears every choice that depended on it, so the form can never hold a combination that is not offered.
 * Choosing Free fills in everything it fixes.
 */
export function choose(choice: Choice, patch: Partial<Choice>): Choice {
  const next = { ...choice, ...patch };
  if (patch.type !== undefined && patch.type !== choice.type) Object.assign(next, { cloud: "", region: "", size: "" });
  if (patch.tenant !== undefined && patch.tenant !== choice.tenant) Object.assign(next, { cloud: "", region: "", size: "" });
  if (patch.cloud !== undefined && patch.cloud !== choice.cloud) Object.assign(next, { region: "", size: "" });
  if (patch.region !== undefined && patch.region !== choice.region) next.size = "";
  if (isFree(next.type)) Object.assign(next, { cloud: FREE_OFFER.cloudProvider, region: FREE_OFFER.region, size: sizeKey(FREE_OFFER) });
  // Vector optimisation cannot stay on at a size too small for it
  if (next.size && !vectorAllowed(next.size.split("|")[0])) next.vectorOptimized = false;
  return next;
}

/** Whether a step has what it needs, given what was chosen and everything on offer. */
export function stepDone(step: Step, c: Choice, offers: readonly Offer[]): boolean {
  const mine = offersFor(offers, c.tenant);
  const ofType = mine.filter((o) => o.type === c.type);
  switch (step) {
    case "tier": return c.type !== "" && tiersIn(offers).includes(c.type);
    case "tenant": return c.tenant !== "" && offers.some((o) => o.type === c.type && (!o.tenantId || o.tenantId === c.tenant));
    case "cloud": return c.cloud !== "" && cloudsOf(ofType).includes(c.cloud);
    case "region": return c.region !== "" && regionsOf(ofType, c.cloud).some((r) => r.region === c.region);
    case "size": return c.size !== "" && sizesOf(mine, c.cloud, c.region, c.type).some((s) => sizeKey(s) === c.size);
    case "name": return nameError(c.name) === undefined;
  }
}

/** The first step that is not done, or undefined when the whole form is ready to review. */
export function firstOpenStep(c: Choice, offers: readonly Offer[]): Step | undefined {
  return stepsFor(c).find((s) => !stepDone(s, c, offers));
}

/** What to send to plan the create, or undefined when something is missing. Memory and storage go together. */
export function createVariables(c: Choice, offers: readonly Offer[]): CreateVariables | undefined {
  if (firstOpenStep(c, offers) !== undefined) return undefined;
  const [memory, storage] = c.size.split("|") as [string, string];
  return {
    input: {
      tenantId: c.tenant,
      cloudProvider: c.cloud,
      region: c.region,
      type: c.type,
      memory,
      storage,
      name: c.name.trim(),
      ...(c.vectorOptimized && vectorAllowed(memory) ? { vectorOptimized: true } : {}),
      ...(c.graphAnalyticsPlugin ? { graphAnalyticsPlugin: true } : {}),
    },
  };
}
