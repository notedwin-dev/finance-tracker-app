import { describe, it, expect } from "vitest";
import { mergeEntities, mergeProfile, toTimestamp } from "../sync";

describe("toTimestamp", () => {
  it("returns 0 for null/undefined/empty", () => {
    expect(toTimestamp(null)).toBe(0);
    expect(toTimestamp(undefined)).toBe(0);
    expect(toTimestamp("")).toBe(0);
  });

  it("returns the number for a numeric value", () => {
    expect(toTimestamp(1234567890)).toBe(1234567890);
  });

  it("parses a string ISO date", () => {
    expect(toTimestamp("2026-06-15T00:00:00.000Z")).toBe(
      new Date("2026-06-15T00:00:00.000Z").getTime(),
    );
  });

  it("returns NaN for an unparseable string (matches original behavior)", () => {
    expect(toTimestamp("not-a-date")).toBeNaN();
  });
});

describe("mergeEntities", () => {
  const a = (id: string, updatedAt: string, label: string) => ({
    id,
    updatedAt,
    label,
  });

  it("trusts cloud by default and takes cloud items", () => {
    const result = mergeEntities(
      [a("1", "2026-06-01", "local1")],
      [a("1", "2026-06-15", "cloud1")],
    );
    expect(result).toEqual([a("1", "2026-06-15", "cloud1")]);
  });

  it("lets local override cloud when local is newer (trustCloud=true)", () => {
    const result = mergeEntities(
      [a("1", "2026-06-20", "local1")],
      [a("1", "2026-06-15", "cloud1")],
    );
    expect(result).toEqual([a("1", "2026-06-20", "local1")]);
  });

  it("uses local as seed when trustCloud=false (local is older)", () => {
    const result = mergeEntities(
      [a("1", "2026-06-15", "local1")],
      [a("1", "2026-06-01", "cloud1")],
      false,
    );
    expect(result).toEqual([a("1", "2026-06-15", "local1")]);
  });

  it("lets cloud override local when trustCloud=false and cloud is newer", () => {
    const result = mergeEntities(
      [a("1", "2026-06-01", "local1")],
      [a("1", "2026-06-15", "cloud1")],
      false,
    );
    expect(result).toEqual([a("1", "2026-06-15", "cloud1")]);
  });

  it("unions items by id when only one side has the entry", () => {
    const result = mergeEntities(
      [a("1", "2026-06-01", "local1")],
      [a("2", "2026-06-15", "cloud2")],
    );
    expect(result).toHaveLength(2);
    expect(result.map((x) => x.id).sort()).toEqual(["1", "2"]);
  });

  it("fills in a missing updatedAt with the current time", () => {
    const result = mergeEntities([], [{ id: "1", label: "no-date" }]);
    expect((result[0] as { updatedAt?: string }).updatedAt).toBeTruthy();
  });
});

describe("mergeProfile", () => {
  it("returns the local profile unchanged when cloud is null", () => {
    const local = { id: "u1", name: "Alice" };
    expect(mergeProfile(local, null)).toBe(local);
  });

  it("returns the local profile unchanged when no fields differ", () => {
    const local = { id: "u1", name: "Alice", maskMode: true };
    const cloud = { name: "Alice", maskMode: true };
    expect(mergeProfile(local, cloud)).toBe(local);
  });

  it("merges differing name", () => {
    const local = { id: "u1", name: "Alice" };
    const cloud = { name: "Bob" };
    expect(mergeProfile(local, cloud)).toEqual({ id: "u1", name: "Bob" });
  });

  it("merges all four known profile fields", () => {
    const local = {
      id: "u1",
      name: "Alice",
      maskMode: false,
      showAIAssistant: true,
      syncChatToSheets: false,
    };
    const cloud = {
      name: "Bob",
      maskMode: true,
      showAIAssistant: false,
      syncChatToSheets: true,
    };
    expect(mergeProfile(local, cloud)).toEqual({
      id: "u1",
      name: "Bob",
      maskMode: true,
      showAIAssistant: false,
      syncChatToSheets: true,
    });
  });
});
