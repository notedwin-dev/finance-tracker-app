import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exchangeRefreshToken } from "../services/auth.services";

// Transient failures (network, 5xx, malformed response) must throw so the
// session recovery path keeps the access token; only genuine auth failures
// resolve null and let the caller clear the session.

const respond = (status: number, body: unknown) => ({
	status,
	json: async () => body,
});

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("exchangeRefreshToken", () => {
	it("returns the new access token on success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => respond(200, { access_token: "new-token" })),
		);

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).resolves.toBe("new-token");
	});

	it("returns null when the refresh token is rejected (invalid_grant)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => respond(400, { error: "invalid_grant" })),
		);

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).resolves.toBeNull();
	});

	it("throws when a tokenless response carries no auth error", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => respond(200, {})));

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).rejects.toThrow();
	});

	it("throws on a protocol error like invalid_request", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => respond(400, { error: "invalid_request" })),
		);

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).rejects.toThrow();
	});

	it("throws on a network failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).rejects.toThrow("Failed to fetch");
	});

	it("throws on a 5xx backend failure", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => respond(503, {})));

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).rejects.toThrow();
	});

	it("throws when rate limited", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => respond(429, {})));

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).rejects.toThrow();
	});

	it("throws on a malformed response body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				status: 200,
				json: async () => {
					throw new SyntaxError("Unexpected token < in JSON");
				},
			})),
		);

		await expect(
			exchangeRefreshToken("refresh-1", "https://backend.test"),
		).rejects.toThrow(SyntaxError);
	});
});