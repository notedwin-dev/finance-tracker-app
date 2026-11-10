import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { parseStoredExpiry, waitForCondition } from "../helpers/sheets.helper";
import * as SheetService from "../services/sheets.services";

describe("parseStoredExpiry", () => {
  it("returns 0 for NaN / empty / garbage stored values", () => {
    expect(parseStoredExpiry("NaN")).toBe(0);
    expect(parseStoredExpiry("")).toBe(0);
    expect(parseStoredExpiry(null)).toBe(0);
    expect(parseStoredExpiry(undefined)).toBe(0);
    expect(parseStoredExpiry("garbage")).toBe(0);
  });

  it("returns the numeric timestamp for valid stored values", () => {
    expect(parseStoredExpiry("1700000000000")).toBe(1700000000000);
  });
});

describe("waitForCondition", () => {
  it("resolves true immediately when the condition already holds", async () => {
    expect(await waitForCondition(() => true, { timeoutMs: 10 })).toBe(true);
  });

  it("resolves false at the deadline when the condition never holds", async () => {
    vi.useFakeTimers();
    const p = waitForCondition(() => false, { intervalMs: 10, timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe(false);
    vi.useRealTimers();
  });

  it("resolves true as soon as the condition becomes true", async () => {
    vi.useFakeTimers();
    let ok = false;
    const p = waitForCondition(() => ok, { intervalMs: 10, timeoutMs: 1000 });
    setTimeout(() => (ok = true), 30);
    await vi.advanceTimersByTimeAsync(100);
    expect(await p).toBe(true);
    vi.useRealTimers();
  });
});

describe("setGapiAccessToken expiry guards", () => {
  beforeEach(() => {
    localStorage.clear();
    (window as any).gapi = {
      client: { setToken: vi.fn() },
    };
  });

  afterEach(() => {
    SheetService.clearGapiAccessToken();
    delete (window as any).gapi;
  });

  it("persists a finite expiresIn", () => {
    SheetService.setGapiAccessToken("tok", 3600);
    const stored = parseInt(localStorage.getItem("google_token_expiry")!, 10);
    expect(stored).toBeGreaterThan(Date.now() + 3000 * 1000);
  });

  it("never persists NaN expiresIn and keeps an existing valid expiry", () => {
    const before = Date.now() + 3600 * 1000;
    localStorage.setItem("google_token_expiry", before.toString());

    SheetService.setGapiAccessToken("tok", NaN);

    const after = parseInt(localStorage.getItem("google_token_expiry")!, 10);
    expect(Number.isFinite(after)).toBe(true);
    expect(after).toBe(before);
  });
});
