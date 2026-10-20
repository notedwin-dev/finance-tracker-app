import { webcrypto } from "node:crypto";

// jsdom does not implement SubtleCrypto / btoa / atob.
if (!globalThis.crypto?.subtle) {
	Object.defineProperty(globalThis, "crypto", {
		value: webcrypto,
		configurable: true,
		writable: true,
	});
}
if (typeof globalThis.window !== "undefined") {
	Object.defineProperty(window, "crypto", {
		value: globalThis.crypto,
		configurable: true,
		writable: true,
	});
}