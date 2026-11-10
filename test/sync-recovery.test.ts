import { describe, it, expect, vi } from "vitest";
import { attemptWithSessionRefresh } from "../helpers/sheets.helper";

describe("attemptWithSessionRefresh", () => {
  const makeDeps = (refreshOk: boolean) => ({
    tryRefresh: vi.fn(async () => refreshOk),
    clearToken: vi.fn(),
  });

  it("does not refresh or clear on success", async () => {
    const load = vi.fn(async () => undefined);
    const deps = makeDeps(true);

    await attemptWithSessionRefresh(load, deps);

    expect(load).toHaveBeenCalledTimes(1);
    expect(deps.tryRefresh).not.toHaveBeenCalled();
    expect(deps.clearToken).not.toHaveBeenCalled();
  });

  it("rethrows non-401 errors without touching the session", async () => {
    const load = vi.fn(async () => {
      throw { status: 500 };
    });
    const deps = makeDeps(true);

    await expect(attemptWithSessionRefresh(load, deps)).rejects.toMatchObject({
      status: 500,
    });
    expect(deps.tryRefresh).not.toHaveBeenCalled();
    expect(deps.clearToken).not.toHaveBeenCalled();
  });

  it("retries once after a successful silent refresh and does not clear", async () => {
    const load = vi
      .fn<typeof load>()
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce(undefined);
    const deps = makeDeps(true);

    await attemptWithSessionRefresh(load, deps);

    expect(load).toHaveBeenCalledTimes(2);
    expect(deps.clearToken).not.toHaveBeenCalled();
  });

  it("clears the token when the retry still 401s (dead refresh token)", async () => {
    const err401 = { status: 401 };
    const load = vi.fn(async () => {
      throw err401;
    });
    const deps = makeDeps(true);

    await expect(attemptWithSessionRefresh(load, deps)).rejects.toBe(err401);
    expect(load).toHaveBeenCalledTimes(2);
    expect(deps.clearToken).toHaveBeenCalledTimes(1);
  });

  it("clears the token when silent refresh fails", async () => {
    const err401 = { status: 401 };
    const load = vi.fn(async () => {
      throw err401;
    });
    const deps = makeDeps(false);

    await expect(attemptWithSessionRefresh(load, deps)).rejects.toBe(err401);
    expect(load).toHaveBeenCalledTimes(1);
    expect(deps.clearToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the token when the refreshed retry fails with a non-401 error", async () => {
    const load = vi
      .fn<typeof load>()
      .mockRejectedValueOnce({ status: 401 })
      .mockRejectedValueOnce({ status: 0 }); // e.g. network drop
    const deps = makeDeps(true);

    await expect(attemptWithSessionRefresh(load, deps)).rejects.toMatchObject({
      status: 0,
    });
    expect(deps.clearToken).not.toHaveBeenCalled();
  });
});
