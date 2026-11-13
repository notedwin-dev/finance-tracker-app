// Per-item write intent versions. Each new write intent for an item bumps a
// monotonic counter; a completion is stale once a newer intent has been
// submitted for the same item. This lets a slow older write fail without
// enqueueing a payload a newer edit already superseded, and lets a stale
// handler skip its local commit so it cannot clobber the newer local value.
// Only the submitted counter is needed: a delivered version can never exceed
// the submitted one, so "a newer intent was submitted" already covers it.
const submitted = new Map<string, number>();

const key = (sheet: string, itemId: string) => `${sheet}:${itemId}`;

/** Record a new write intent and return its version token. */
export const beginIntent = (sheet: string, itemId: string): number => {
	const k = key(sheet, itemId);
	const version = (submitted.get(k) ?? 0) + 1;
	submitted.set(k, version);
	return version;
};

/** True when a newer intent for this item supersedes the given version. */
export const isSuperseded = (
	sheet: string,
	itemId: string,
	version: number,
): boolean => (submitted.get(key(sheet, itemId)) ?? 0) > version;

/** Test hook: drop all tracked intents. */
export const resetWriteIntents = (): void => {
	submitted.clear();
};