/** AuraDB Free is the one tier with a different rule: see FREE_DELETE_ONLY. */
export const FREE_TIER = 'free-db';

export const isFreeTier = (tier: string | null | undefined): boolean => tier === FREE_TIER;

/** What to tell the person, and what the engine says, when a change is asked of a Free instance. */
export const FREE_DELETE_ONLY = 'AuraDB Free instances can only be deleted. They cannot be paused, resumed or edited.';
