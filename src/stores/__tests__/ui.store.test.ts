import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../ui.store";

describe("ui.store", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
  });

  it("defaults to MYR display currency", () => {
    expect(useUIStore.getState().displayCurrency).toBe("MYR");
  });

  it("switches between display currencies", () => {
    useUIStore.getState().setDisplayCurrency("USD");
    expect(useUIStore.getState().displayCurrency).toBe("USD");
    useUIStore.getState().setDisplayCurrency("MYR");
    expect(useUIStore.getState().displayCurrency).toBe("MYR");
  });
});
