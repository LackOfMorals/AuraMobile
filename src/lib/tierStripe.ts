/**
 * The colour stripe across the top of an instance card says which Aura tier it is. Four tiers, four colours from the Okabe-Ito
 * palette, which people with the common kinds of colour blindness can tell apart. Colour is never the only signal: the tier name
 * is in each card's spoken label and on the Detail screen.
 */
export interface TierStripe {
  key: "free" | "professional" | "business-critical" | "enterprise" | "other";
  color: string;
}

const STRIPES: Record<TierStripe["key"], string> = {
  free: "#56B4E9", // sky blue
  professional: "#009E73", // bluish green
  "business-critical": "#E69F00", // orange
  enterprise: "#CC79A7", // reddish purple
  other: "#8A94A3", // a tier this app does not know, or none
};

/** The data-science tiers share the colour of the database tier with the same name. */
export function tierStripe(tier?: string | null): TierStripe {
  const key: TierStripe["key"] =
    tier === "free-db" ? "free"
    : tier === "professional-db" || tier === "professional-ds" ? "professional"
    : tier === "business-critical" ? "business-critical"
    : tier === "enterprise-db" || tier === "enterprise-ds" ? "enterprise"
    : "other";
  return { key, color: STRIPES[key] };
}
