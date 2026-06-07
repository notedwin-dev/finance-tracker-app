import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTimeRemaining } from "../goal-time";

const mockDate = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

const restoreRealDate = () => {
  vi.useRealTimers();
};

describe("formatTimeRemaining", () => {
  beforeEach(() => {
    mockDate("2024-06-15T10:00:00.000Z");
  });

  afterEach(() => {
    restoreRealDate();
  });

  it("returns DUE TODAY when deadline is today", () => {
    expect(formatTimeRemaining("2024-06-15")).toBe("DUE TODAY");
  });

  it("returns X LEFT for future dates", () => {
    expect(formatTimeRemaining("2024-06-20")).toBe("5D LEFT");
  });

  it("returns PAST DUE BY for past dates", () => {
    expect(formatTimeRemaining("2024-06-10")).toBe("PAST DUE BY 5D");
  });

  it("includes months and years in the parts", () => {
    expect(formatTimeRemaining("2025-08-20")).toBe("1Y 2M 5D LEFT");
  });

  it("handles long past durations", () => {
    expect(formatTimeRemaining("2022-06-10")).toMatch(/^PAST DUE BY 2Y/);
  });
});
