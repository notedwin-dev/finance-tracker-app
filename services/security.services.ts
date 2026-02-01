const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;

/**
 * Derives a cryptographic key from a password and salt.
 */
async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
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
 * Encrypts a string using a password.
 */
export async function encryptData(
  data: string,
  password: string,
  salt: string,
): Promise<string> {
  if (!data) return "";
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(data),
  );

  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  // Use a prefix to identify encrypted data
  return "ENC:" + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64 string using a password.
 */
export async function decryptData(
  encryptedBase64: string,
  password: string,
  salt: string,
): Promise<string> {
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
    const key = await deriveKey(password, salt);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      data,
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    // Return original if decryption fails (might be wrong password)
    return encryptedBase64;
  }
}

/**
 * Checks if biometric authentication is available.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (window.PublicKeyCredential) {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Performs a biometric challenge (TouchID/FaceID) via WebAuthn.
 */
export async function verifyWithBiometrics(
  overrideCredId?: string,
): Promise<boolean> {
  if (!(await isBiometricAvailable())) {
    return true;
  }

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));

    // Priority: 1. Manual override (from cloud), 2. Local storage
    const storedCredId =
      overrideCredId || localStorage.getItem("biometric_cred_id");

    if (!storedCredId) {
      return false;
    }

    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
      allowCredentials: [
        {
          id: Uint8Array.from(atob(storedCredId), (c) => c.charCodeAt(0)),
          type: "public-key",
        },
      ],
    };

    await window.navigator.credentials.get({ publicKey: options });
    return true;
  } catch (error) {
    console.warn("Biometric verification failed or cancelled:", error);
    return false;
  }
}

/**
 * Checks if biometrics are already registered for this device.
 */
export function isBiometricRegistered(): boolean {
  return !!localStorage.getItem("biometric_cred_id");
}

/**
 * Registers the current device for biometric authentication.
 */
export async function registerBiometrics(
  username: string,
): Promise<string | null> {
  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userId = window.crypto.getRandomValues(new Uint8Array(16));

    const options: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "ZenFinance", id: window.location.hostname },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        userVerification: "required",
        // Removing 'platform' constraint to allow Cross-Device (QR code) and Synced Passkeys
      },
      timeout: 60000,
    };

    const credential = (await window.navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential;
    if (credential) {
      const rawId = new Uint8Array(credential.rawId);
      const base64Id = btoa(String.fromCharCode(...rawId));
      localStorage.setItem("biometric_cred_id", base64Id);
      return base64Id; // Return the ID so it can be synced to cloud
    }
    return null;
  } catch (error) {
    console.error("Biometric registration failed:", error);
    return null;
  }
}
