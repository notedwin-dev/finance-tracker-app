const SENSITIVE_KEYS = new Set([
	"geminiApiKey",
	"apiKey",
	"apikey",
	"api_key",
	"googleApiKey",
	"google_api_key",
	"VITE_GEMINI_API_KEY",
	"VITE_GOOGLE_API_KEY",
	"password",
	"accessToken",
	"access_token",
	"refreshToken",
	"refresh_token",
	"idToken",
	"id_token",
	"authorization",
	"cookie",
	"set-cookie",
	"totpSecret",
	"vaultSalt",
	"masterKey",
	"encrypted_vault_key",
	"biometricCredId",
	"biometricCredIds",
	"cardNumber",
	"cvv",
	"expiry",
	"holderName",
	"accountNumber",
]);

const REDACTED = "[REDACTED]";

const API_KEY_REGEX =
	/(?:^|[^a-zA-Z0-9])(?:AIzaSy[a-zA-Z0-9_-]{20,}|ya29\.[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,})/;

const normalizedSensitiveSet = new Set(
	Array.from(SENSITIVE_KEYS).map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "")),
);

const normalizeKey = (key: string): string =>
	key.toLowerCase().replace(/[^a-z0-9]/g, "");

const shouldRedactValue = (key: string): boolean =>
	normalizedSensitiveSet.has(normalizeKey(key));

const redactString = (value: string): string =>
	API_KEY_REGEX.test(value) ? REDACTED : value;

const redactError = (err: Error, depth: number): Record<string, unknown> => {
	const out: Record<string, unknown> = {
		name: err.name,
		message: redact(err.message, depth + 1),
		stack: redact(err.stack ?? "", depth + 1),
	};
	for (const [k, v] of Object.entries(err as unknown as Record<string, unknown>)) {
		if (k !== "name" && k !== "message" && k !== "stack") {
			out[k] = shouldRedactValue(k) ? REDACTED : redact(v, depth + 1);
		}
	}
	return out;
};

const redactObject = (value: Record<string, unknown>, depth: number): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		out[k] = shouldRedactValue(k) ? REDACTED : redact(v, depth + 1);
	}
	return out;
};

function redact(value: unknown, depth = 0): unknown {
	if (depth > 5) return "[depth-limit]";
	if (value === null || value === undefined) return value;
	if (typeof value === "string") return redactString(value);
	if (typeof value === "number" || typeof value === "boolean") return value;
	if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
	if (typeof value === "object") {
		if (value instanceof Error) return redactError(value, depth);
		return redactObject(value as Record<string, unknown>, depth);
	}
	return value;
}

const format = (args: unknown[]): unknown[] =>
	args.map((a) => {
		if (typeof a === "object" && a !== null) {
			return redact(a);
		}
		if (typeof a === "string" && API_KEY_REGEX.test(a)) {
			return REDACTED;
		}
		return a;
	});

export const logger = {
	log: (...args: unknown[]) => console.log(...format(args)),
	warn: (...args: unknown[]) => console.warn(...format(args)),
	error: (...args: unknown[]) => console.error(...format(args)),
	info: (...args: unknown[]) => console.info(...format(args)),
	debug: (...args: unknown[]) => console.debug(...format(args)),
};

export const __test__ = { redact, SENSITIVE_KEYS, API_KEY_REGEX };
