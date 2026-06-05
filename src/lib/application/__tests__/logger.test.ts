import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger, __test__ } from "../logger";

const { redact, SENSITIVE_KEYS } = __test__;

describe("logger redact", () => {
	it("redacts known sensitive keys at any depth", () => {
		const input = {
			email: "a@b.com",
			geminiApiKey: "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
			nested: {
				accessToken: "ya29.abcdefghijklmnopqrstuvwxyz",
				safe: "ok",
			},
			arr: [{ refreshToken: "1//refresh-token" }, "ok"],
		};
		const out = redact(input) as any;
		expect(out.email).toBe("a@b.com");
		expect(out.geminiApiKey).toBe("[REDACTED]");
		expect(out.nested.accessToken).toBe("[REDACTED]");
		expect(out.nested.safe).toBe("ok");
		expect(out.arr[0].refreshToken).toBe("[REDACTED]");
		expect(out.arr[1]).toBe("ok");
	});

	it("redacts inline API-key-looking strings", () => {
		expect(redact("token AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 here")).toBe(
			"[REDACTED]",
		);
	});

	it("preserves non-sensitive primitive values", () => {
		expect(redact(42)).toBe(42);
		expect(redact(true)).toBe(true);
		expect(redact("hello")).toBe("hello");
		expect(redact(null)).toBe(null);
	});

	it("handles arrays of primitives", () => {
		expect(redact([1, "a", false])).toEqual([1, "a", false]);
	});

	it("clamps recursion at depth 5", () => {
		let deep: any = { value: "ok" };
		for (let i = 0; i < 10; i++) deep = { nested: deep };
		const out = redact(deep) as any;
		expect(JSON.stringify(out)).toContain("[depth-limit]");
	});

	it("covers all keys in the allowlist", () => {
		for (const key of SENSITIVE_KEYS) {
			const out = redact({ [key]: "leak-value-12345" }) as any;
			expect(out[key]).toBe("[REDACTED]");
		}
	});
});

describe("logger proxies", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let warnSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("redacts objects when forwarded to console.log", () => {
		logger.log({ geminiApiKey: "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" });
		expect(logSpy).toHaveBeenCalledWith({ geminiApiKey: "[REDACTED]" });
	});

	it("redacts inline API-key strings", () => {
		logger.warn("see key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 leaked");
		const calls = (console.warn as any).mock.calls;
		expect(calls[0][0]).toBe("[REDACTED]");
	});

	it("leaves non-sensitive messages alone", () => {
		logger.log("hello", 42, true);
		expect(logSpy).toHaveBeenCalledWith("hello", 42, true);
	});
});
