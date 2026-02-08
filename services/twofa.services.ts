/**
 * Two-Factor Authentication Service
 * Supports TOTP-based 2FA compatible with:
 * - Google Authenticator
 * - Authy
 * - Microsoft Authenticator
 * - Any RFC 6238 compliant authenticator
 */

import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const APP_NAME = "ZenFinance";

/**
 * Generate a new TOTP secret for a user
 */
export const generateTOTPSecret = (email: string): string => {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  
  return totp.secret.base32;
};

/**
 * Generate QR code data URL for scanning with authenticator apps
 */
export const generateQRCode = async (secret: string, email: string): Promise<string> => {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const otpauthURL = totp.toString();
  
  try {
    const qrCodeDataURL = await QRCode.toDataURL(otpauthURL, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    throw new Error("Failed to generate QR code");
  }
};

/**
 * Verify a TOTP code
 */
export const verifyTOTP = (secret: string, token: string): boolean => {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Allow 1 window before and after for clock drift
    const delta = totp.validate({
      token,
      window: 1,
    });

    return delta !== null;
  } catch (error) {
    console.error("TOTP verification failed:", error);
    return false;
  }
};

/**
 * Generate current TOTP code (for testing/display purposes)
 */
export const generateTOTPCode = (secret: string): string => {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.generate();
};

/**
 * Get time remaining until next TOTP code
 */
export const getTOTPTimeRemaining = (): number => {
  const period = 30;
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
};
