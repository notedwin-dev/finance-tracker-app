import { describe, it, expect } from "vitest";
import {
	hashPassword,
	verifyPassword,
	isLegacyHash,
	PBKDF2_ITERATIONS,
} from "../crypto.services";

describe("crypto.services", () => {
	describe("hashPassword", () => {
		it("produces a pbkdf2-prefixed string with all 4 segments", async () => {
			const h = await hashPassword("hunter2");
			const parts = h.split("$");
			expect(parts).toHaveLength(4);
			expect(parts[0]).toBe("pbkdf2");
			expect(parseInt(parts[1], 10)).toBe(PBKDF2_ITERATIONS);
			expect(parts[2].length).toBeGreaterThan(0);
			expect(parts[3].length).toBeGreaterThan(0);
		});

		it("emits a unique salt per call", async () => {
			const a = await hashPassword("same-password");
			const b = await hashPassword("same-password");
			expect(a).not.toBe(b);
		});
	});

	describe("verifyPassword", () => {
		it("accepts the correct password for a new hash", async () => {
			const h = await hashPassword("correct horse battery staple");
			expect(await verifyPassword("correct horse battery staple", h)).toBe(
				true,
			);
		});

		it("rejects an incorrect password for a new hash", async () => {
			const h = await hashPassword("hunter2");
			expect(await verifyPassword("hunter3", h)).toBe(false);
		});

		it("rejects an empty stored hash", async () => {
			const h = await hashPassword("hunter2");
			expect(await verifyPassword("hunter2", "")).toBe(false);
		});

		it("rejects an empty password input", async () => {
			const h = await hashPassword("hunter2");
			expect(await verifyPassword("", h)).toBe(false);
		});

		it("verifies legacy SHA-256 hashes (no salt)", async () => {
			const legacyHash = await sha256Hex("legacy-password");
			expect(await verifyPassword("legacy-password", legacyHash)).toBe(true);
			expect(await verifyPassword("wrong", legacyHash)).toBe(false);
		});

		it("does not accept malformed stored values", async () => {
			expect(await verifyPassword("anything", "garbage")).toBe(false);
			expect(await verifyPassword("anything", "pbkdf2$notanumber$xx$yy")).toBe(
				false,
			);
		});

		it("rejects pbkdf2 with tampered hash", async () => {
			const h = await hashPassword("hunter2");
			const parts = h.split("$");

			const decodeBase64ToBytes = (b64: string) =>
				Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
			const flipFirstByte = (bytes: Uint8Array) => {
				bytes[0] = bytes[0] ^ 0xff;
			};
			const encodeBytesToBase64 = (bytes: Uint8Array) =>
				btoa(String.fromCharCode(...bytes));

			const hashBytes = decodeBase64ToBytes(parts[3]);
			flipFirstByte(hashBytes);
			const tamperedHash = encodeBytesToBase64(hashBytes);
			const tampered = `${parts[0]}$${parts[1]}$${parts[2]}$${tamperedHash}`;

			expect(await verifyPassword("hunter2", tampered)).toBe(false);
		});
	});

	describe("isLegacyHash", () => {
		it("flags a 64-char hex string as legacy", async () => {
			const legacyHash = await sha256Hex("password");
			expect(isLegacyHash(legacyHash)).toBe(true);
		});

		it("flags a new pbkdf2 hash as non-legacy", async () => {
			const h = await hashPassword("password");
			expect(isLegacyHash(h)).toBe(false);
		});

		it("flags garbage as legacy (treat as needing migration)", () => {
			expect(isLegacyHash("garbage")).toBe(true);
			expect(isLegacyHash("")).toBe(false);
		});
	});
});

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
