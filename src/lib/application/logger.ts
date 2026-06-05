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

const redact = (value: unknown, depth = 0): unknown => {
	if (depth > 5) return "[depth-limit]";
	if (value === null || value === undefined) return value;

	if (typeof value === "string") {
		if (/(?:^|[^a-zA-Z0-9])(?:AIzaSy[a-zA-Z0-9_-]{20,}|ya29\.[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,})/.test(value)) {
			return REDACTED;
		}
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => redact(item, depth + 1));
	}

	if (typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = SENSITIVE_KEYS.has(k) ? REDACTED : redact(v, depth + 1);
		}
		return out;
	}

	return value;
};

const format = (args: unknown[]): unknown[] =>
	args.map((a) => {
		if (typeof a === "object" && a !== null) {
			return redact(a);
		}
		if (typeof a === "string" && /(?:^|[^a-zA-Z0-9])(?:AIzaSy[a-zA-Z0-9_-]{20,}|ya29\.[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,})/.test(a)) {
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

export const __test__ = { redact, SENSITIVE_KEYS };
