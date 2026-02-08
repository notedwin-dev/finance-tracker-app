/**
 * Biometric Authentication Service
 * Uses WebAuthn API for fingerprint, face recognition, etc.
 */

/**
 * Check if biometrics are available on this device
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
};

/**
 * Register biometric credential
 */
export const registerBiometric = async (email: string): Promise<string> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn not supported on this device");
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "ZenFinance",
      id: window.location.hostname,
    },
    user: {
      id: new TextEncoder().encode(email),
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      requireResidentKey: false,
      userVerification: "required",
    },
    timeout: 60000,
    attestation: "none",
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      throw new Error("Failed to create credential");
    }

    // Return credential ID as base64
    const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    return credentialId;
  } catch (error) {
    console.error("Biometric registration failed:", error);
    throw new Error("Biometric registration failed");
  }
};

/**
 * Authenticate with biometric
 */
export const authenticateWithBiometric = async (credentialId: string): Promise<boolean> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn not supported on this device");
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  // Convert base64 credential ID back to ArrayBuffer
  const credentialIdBuffer = Uint8Array.from(atob(credentialId), c => c.charCodeAt(0));

  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: [
      {
        id: credentialIdBuffer,
        type: "public-key",
        transports: ["internal"],
      },
    ],
    timeout: 60000,
    userVerification: "required",
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    return assertion !== null;
  } catch (error) {
    console.error("Biometric authentication failed:", error);
    return false;
  }
};
