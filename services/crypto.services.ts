const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH_ALGO = "SHA-256";
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PREFIX = "pbkdf2";
const LEGACY_HEX_LENGTH = 64;

const encoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

const fromHex = (hex: string): Uint8Array => {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return out;
};

const derivePbkdf2 = async (
	password: string,
	salt: Uint8Array,
	iterations: number,
): Promise<Uint8Array> => {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: PBKDF2_HASH_ALGO,
			salt,
			iterations,
		},
		keyMaterial,
		HASH_BYTES * 8,
	);
	return new Uint8Array(bits);
};

const isLegacySha256Hash = (stored: string): boolean =>
	/^[a-f0-9]{64}$/.test(stored);

const verifyLegacySha256 = async (
	password: string,
	stored: string,
): Promise<boolean> => {
	const data = encoder.encode(password);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const hex = toHex(new Uint8Array(hash));
	if (hex.length !== stored.length) return false;
	let diff = 0;
	for (let i = 0; i < hex.length; i++) {
		diff |= hex.charCodeAt(i) ^ stored.charCodeAt(i);
	}
	return diff === 0;
};

const parsePbkdf2 = (
	stored: string,
): { iterations: number; salt: Uint8Array; hash: Uint8Array } | null => {
	const parts = stored.split("$");
	if (parts.length !== 4 || parts[0] !== PREFIX) return null;
	const iterations = parseInt(parts[1], 10);
	if (!Number.isFinite(iterations) || iterations < 1000) return null;
	const salt = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));
	const hash = Uint8Array.from(atob(parts[3]), (c) => c.charCodeAt(0));
	if (salt.length !== SALT_BYTES) return null;
	if (hash.length !== HASH_BYTES) return null;
	return { iterations, salt, hash };
};

const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
};

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
	const saltB64 = btoa(String.fromCharCode(...salt));
	const hashB64 = btoa(String.fromCharCode(...hash));
	return `${PREFIX}$${PBKDF2_ITERATIONS}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	if (!stored) return false;

	const pbkdf2 = parsePbkdf2(stored);
	if (pbkdf2) {
		const candidate = await derivePbkdf2(
			password,
			pbkdf2.salt,
			pbkdf2.iterations,
		);
		return constantTimeEqual(candidate, pbkdf2.hash);
	}

	if (isLegacySha256Hash(stored) && stored.length === LEGACY_HEX_LENGTH) {
		return verifyLegacySha256(password, stored);
	}

	return false;
}

export function isLegacyHash(stored: string): boolean {
	if (!stored) return false;
	if (isLegacySha256Hash(stored)) return true;
	const pbkdf2 = parsePbkdf2(stored);
	if (!pbkdf2) return true;
	return pbkdf2.iterations < PBKDF2_ITERATIONS;
}

export { PBKDF2_ITERATIONS };
