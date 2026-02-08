/**
 * Security Service
 * Handles biometric + 2FA authentication and encryption
 * No more password-based vault - simplified to biometrics + TOTP
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

/**
 * Derive encryption key from TOTP secret
 * Used to create a master key for encrypting account data
 */
export async function deriveKeyFromTOTP(
  totpSecret: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(totpSecret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("zenfinance-2fa-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt data with a CryptoKey
 */
export async function encryptWithKey(
  data: string,
  key: CryptoKey,
): Promise<string> {
  if (!data) return "";
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(data),
  );

  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  return "SEC:" + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with a CryptoKey
 */
export async function decryptWithKey(
  encryptedBase64: string,
  key: CryptoKey,
): Promise<string | null> {
  if (!encryptedBase64 || !encryptedBase64.startsWith("SEC:"))
    return encryptedBase64;

  try {
    const rawBase64 = encryptedBase64.substring(4);
    const combined = new Uint8Array(
      atob(rawBase64)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );

    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data,
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}

/**
 * Generate a master encryption key
 * This will be encrypted with the derived key and stored in cloud
 */
export async function generateMasterKey(): Promise<string> {
  const keyData = window.crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...keyData));
}

/**
 * Encrypt master key with derived key from TOTP
 */
export async function encryptMasterKey(
  masterKey: string,
  totpSecret: string,
): Promise<string> {
  const derivedKey = await deriveKeyFromTOTP(totpSecret);
  return encryptWithKey(masterKey, derivedKey);
}

/**
 * Decrypt master key with derived key from TOTP
 */
export async function decryptMasterKey(
  encryptedMasterKey: string,
  totpSecret: string,
): Promise<CryptoKey | null> {
  const derivedKey = await deriveKeyFromTOTP(totpSecret);
  const masterKeyB64 = await decryptWithKey(encryptedMasterKey, derivedKey);
  
  if (!masterKeyB64) return null;

  const masterKeyData = Uint8Array.from(atob(masterKeyB64), c => c.charCodeAt(0));
  
  return window.crypto.subtle.importKey(
    "raw",
    masterKeyData,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt account details with master key
 */
export async function encryptAccountData(
  accountDetails: string,
  masterKey: CryptoKey,
): Promise<string> {
  return encryptWithKey(accountDetails, masterKey);
}

/**
 * Decrypt account details with master key
 */
export async function decryptAccountData(
  encryptedDetails: string,
  masterKey: CryptoKey,
): Promise<string | null> {
  return decryptWithKey(encryptedDetails, masterKey);
}

/**
 * Checks if biometric/passkey authentication is available.
 * Checks for both platform authenticators (TouchID/FaceID) and conditional mediation (passkeys)
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }
  
  try {
    // Check if platform authenticator is available (TouchID/FaceID)
    const platformAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (platformAvailable) {
      return true;
    }
    
    // Check if conditional mediation is available (passkeys/roaming authenticators)
    if (window.PublicKeyCredential.isConditionalMediationAvailable) {
      const conditionalAvailable = await window.PublicKeyCredential.isConditionalMediationAvailable();
      if (conditionalAvailable) {
        return true;
      }
    }
    
    // If PublicKeyCredential exists, assume some form of WebAuthn is available
    return true;
  } catch (error) {
    console.warn("Error checking biometric availability:", error);
    // If there's an error but WebAuthn API exists, assume it's available
    return true;
  }
}

/**
 * Registers the current device for biometric authentication.
 */
export async function registerBiometrics(
  username: string,
  existingCredIds?: string[],
): Promise<string | null> {
  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userId = window.crypto.getRandomValues(new Uint8Array(16));

    // Get proper RP ID - handle localhost and production domains
    let rpId = window.location.hostname;
    // For localhost with port, strip the port
    if (rpId.startsWith("localhost")) {
      rpId = "localhost";
    }

    const options: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "ZenFinance", id: rpId },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },  // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        userVerification: "preferred",
        // Don't specify authenticatorAttachment - allow both platform and roaming
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    };

    // Prevent re-registration of existing credentials (privacy consideration)
    if (existingCredIds && existingCredIds.length > 0) {
      options.excludeCredentials = existingCredIds.map(id => ({
        id: Uint8Array.from(atob(id), c => c.charCodeAt(0)),
        type: "public-key",
      }));
    }

    const credential = (await window.navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential;
    
    if (credential) {
      const rawId = new Uint8Array(credential.rawId);
      const base64Id = btoa(String.fromCharCode(...rawId));
      return base64Id;
    }
    return null;
  } catch (error) {
    console.error("Biometric registration failed:", error);
    return null;
  }
}

/**
 * Performs a biometric challenge (TouchID/FaceID) via WebAuthn.
 */
export async function verifyWithBiometrics(
  credentialId: string,
): Promise<boolean> {
  if (!(await isBiometricAvailable())) {
    return false;
  }

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));

    // Get proper RP ID - must match what was used during registration
    let rpId = window.location.hostname;
    if (rpId.startsWith("localhost")) {
      rpId = "localhost";
    }

    const credIdBytes = Uint8Array.from(atob(credentialId), (c) => c.charCodeAt(0));

    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId,
      timeout: 60000,
      userVerification: "preferred",
      allowCredentials: [{
        id: credIdBytes,
        type: "public-key",
      }],
    };

    const assertion = await window.navigator.credentials.get({
      publicKey: options,
    });

    return assertion !== null;
  } catch (error) {
    console.error("Biometric verification failed:", error);
    return false;
  }
}

// =========================================
// LEGACY VAULT PASSWORD FUNCTIONS
// Kept for backward compatibility - DO NOT USE IN NEW CODE
// These will be removed after full migration to biometric + 2FA
// =========================================

/**
 * @deprecated Use biometric + TOTP instead
 */
export async function hashPassword(
  password: string,
  salt: string,
  iterations: number = 100000,
): Promise<string> {
  console.warn("hashPassword is deprecated - migrate to biometric + 2FA");
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const hashArray = new Uint8Array(bits);
  return "HASHED:" + btoa(String.fromCharCode(...hashArray));
}

/**
 * @deprecated Use encryptWithKey instead
 */
export async function encryptData(
  data: string,
  password: string,
  salt: string,
): Promise<string> {
  console.warn("encryptData is deprecated - use encryptAccountData instead");
  if (!data) return "";
  
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(data),
  );

  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  return "ENC:" + btoa(String.fromCharCode(...combined));
}

/**
 * @deprecated Use decryptWithKey instead
 */
export async function decryptData(
  encryptedBase64: string,
  password: string,
  salt: string,
): Promise<string | null> {
  console.warn("decryptData is deprecated - use decryptAccountData instead");
  if (!encryptedBase64 || !encryptedBase64.startsWith("ENC:"))
    return encryptedBase64;

  try {
    const rawBase64 = encryptedBase64.substring(4);
    const combined = new Uint8Array(
      atob(rawBase64)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );

    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"],
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data,
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}

/**
 * @deprecated Biometrics now registered per-device in new security model
 */
export function isBiometricRegistered(): boolean {
  console.warn("isBiometricRegistered is deprecated");
  // For backward compatibility, always return false to trigger proper biometric setup
  return false;
}

