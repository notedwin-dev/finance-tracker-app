export function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

const withUpdatedAt = <T extends { updatedAt?: unknown }>(
  item: T,
  now: string,
): T => ({ ...item, updatedAt: item.updatedAt || now });

const setEntity = <T extends { id: string; updatedAt?: unknown }>(
  map: Map<string, T>,
  item: T,
  now: string,
) => {
  if (item.id) map.set(String(item.id), withUpdatedAt(item, now));
};

const mergeNewerEntity = <T extends { id: string; updatedAt?: unknown }>(
  map: Map<string, T>,
  item: T,
  now: string,
) => {
  const id = String(item.id);
  if (map.has(id)) {
    const existing = map.get(id)!;
    if (toTimestamp(item.updatedAt) > toTimestamp(existing.updatedAt)) {
      setEntity(map, item, now);
    }
  } else {
    setEntity(map, item, now);
  }
};

export function mergeEntities<T extends { id: string; updatedAt?: unknown }>(
  local: T[],
  cloud: T[],
  trustCloud: boolean = true,
): T[] {
  const map = new Map<string, T>();
  const now = new Date().toISOString();

  const primary = trustCloud ? cloud : local;
  const secondary = trustCloud ? local : cloud;

  primary.forEach((i) => setEntity(map, i, now));
  secondary.forEach((i) => mergeNewerEntity(map, i, now));

  return Array.from(map.values());
}

const PROFILE_MERGE_FIELDS = [
  "name",
  "maskMode",
  "showAIAssistant",
  "syncChatToSheets",
] as const;

export function mergeProfile<T extends Record<string, unknown>>(
  local: T,
  cloud: Partial<T> | null | undefined,
): T {
  if (!cloud) return local;
  const updates: Record<string, unknown> = {};
  for (const field of PROFILE_MERGE_FIELDS) {
    const cloudVal = (cloud as Record<string, unknown>)[field];
    if (cloudVal !== undefined && cloudVal !== (local as Record<string, unknown>)[field]) {
      updates[field] = cloudVal;
    }
  }
  if (Object.keys(updates).length === 0) return local;
  return { ...local, ...updates };
}
