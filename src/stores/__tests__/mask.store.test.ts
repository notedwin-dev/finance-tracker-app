import { describe, it, expect, beforeEach } from "vitest";
import { useMaskStore } from "../mask.store";

describe("mask.store", () => {
  beforeEach(() => {
    useMaskStore.getState().reset();
  });

  it("starts with mask mode disabled", () => {
    const state = useMaskStore.getState();
    expect(state.maskMode).toBe(false);
  });

  it("toggles mask mode", () => {
    useMaskStore.getState().setMaskMode(true);
    expect(useMaskStore.getState().maskMode).toBe(true);
    useMaskStore.getState().setMaskMode(false);
    expect(useMaskStore.getState().maskMode).toBe(false);
  });
});
