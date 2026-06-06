export function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

export function mergeEntities<T extends { id: string; updatedAt?: unknown }>(
  local: T[],
  cloud: T[],
  trustCloud: boolean = true,
): T[] {
  const map = new Map<string, T>();
  const now = new Date().toISOString();

  if (trustCloud) {
    cloud.forEach((i) => {
      if (i.id) {
        map.set(String(i.id), { ...i, updatedAt: i.updatedAt || now });
      }
    });
    local.forEach((i) => {
      const id = String(i.id);
      if (map.has(id)) {
        const cloudItem = map.get(id)!;
        if (toTimestamp(i.updatedAt) > toTimestamp(cloudItem.updatedAt)) {
          map.set(id, { ...i, updatedAt: i.updatedAt || now });
        }
      } else if (i.id) {
        map.set(id, { ...i, updatedAt: i.updatedAt || now });
      }
    });
  } else {
    local.forEach((i) => {
      if (i.id) {
        map.set(String(i.id), { ...i, updatedAt: i.updatedAt || now });
      }
    });
    cloud.forEach((i) => {
      const id = String(i.id);
      if (map.has(id)) {
        const localItem = map.get(id)!;
        if (toTimestamp(i.updatedAt) > toTimestamp(localItem.updatedAt)) {
          map.set(id, { ...i, updatedAt: i.updatedAt || now });
        }
      } else if (i.id) {
        map.set(id, { ...i, updatedAt: i.updatedAt || now });
      }
    });
  }

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
