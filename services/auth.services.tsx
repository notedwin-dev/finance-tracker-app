import React, { createContext, useContext, useEffect, useState } from "react";
import { useGoogleLogin, googleLogout } from "@react-oauth/google";
import * as SheetService from "./sheets.services";
import * as StorageService from "./storage.services";
import { UserProfile } from "../types";
import { hashPassword, verifyPassword } from "./crypto.services";

interface AuthContextType {
  profile: UserProfile;
  loginWithGoogle: () => void;
  emailLogin: (email: string, pass: string) => Promise<void>;
  emailSignup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  loginOffline: () => void;
  unlinkCloud: () => void;
  updateProfile: (updates: Partial<UserProfile>, skipCloud?: boolean) => void;
  isInitialized: boolean;
  authStatus: string | null;
  isAuthLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3001";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<UserProfile>(
    StorageService.getStoredProfile(),
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem("google_refresh_token");
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (data.access_token) {
        const expiresAt = Date.now() + 3500 * 1000; // Assume ~1hr
        SheetService.setGapiAccessToken(data.access_token, 3600);
        localStorage.setItem("google_access_token", data.access_token);
        localStorage.setItem("google_token_expiry", expiresAt.toString());
        return data.access_token;
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
    return null;
  };

  // Initialize GAPI client on mount
  useEffect(() => {
    if (profile.id) {
      SheetService.setSheetUser(profile.id);
    }

    const initAuth = async () => {
      await SheetService.initGapiClient();

      const savedToken = localStorage.getItem("google_access_token");
      const savedExpiry = localStorage.getItem("google_token_expiry");
      const refreshToken = localStorage.getItem("google_refresh_token");

      let token = savedToken;
      let expiry = savedExpiry ? parseInt(savedExpiry) : 0;

      if (refreshToken && (!token || Date.now() > expiry - 300000)) {
        token = await refreshAccessToken();
      } else if (token) {
        SheetService.setGapiAccessToken(token, (expiry - Date.now()) / 1000);
      }

      setIsInitialized(true);
    };

    initAuth();
  }, []);

  const handleGoogleSuccess = async ({ code }) => {
    setIsAuthLoading(true);
    setAuthStatus("Exchanging code for tokens...");
    try {
      const res = await fetch(`${BACKEND_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const tokens = await res.json();

      if (!tokens.access_token) throw new Error("No access token returned");

      setAuthStatus("Connecting to Google Services...");
      const expiresAt = Date.now() + tokens.expires_in * 1000;
      SheetService.setGapiAccessToken(tokens.access_token, tokens.expires_in);

      localStorage.setItem("google_access_token", tokens.access_token);
      localStorage.setItem("google_token_expiry", expiresAt.toString());
      if (tokens.refresh_token) {
        localStorage.setItem("google_refresh_token", tokens.refresh_token);
      }

      setAuthStatus("Fetching user info...");
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
      );
      const userInfo = await userInfoRes.json();

      const userId = userInfo.sub || userInfo.email;
      SheetService.setSheetUser(userId);

      setAuthStatus("Checking sync settings...");
      // Ensure user exists in the Users sheet for settings sync
      let cloudUser = await SheetService.findUser(userInfo.email);
      if (!cloudUser) {
        setAuthStatus("Creating your cloud profile...");
        await SheetService.createUser({
          email: userInfo.email,
          password: "GOOGLE_AUTH",
          name: userInfo.name,
        });
        cloudUser = await SheetService.findUser(userInfo.email);
      }

      setAuthStatus("Synchronizing profile...");
      const newProfile: UserProfile = {
        ...profile,
        id: userId,
        name: userInfo.name,
        email: userInfo.email,
        photoUrl: userInfo.picture,
        isLoggedIn: true,
        offlineMode: false,
        // Sync cloud settings if they exist
        isVaultEnabled: cloudUser?.isVaultEnabled ?? profile.isVaultEnabled,
        isVaultCreated: cloudUser?.isVaultCreated ?? profile.isVaultCreated,
        isVaultLocked: cloudUser?.isVaultLocked ?? profile.isVaultLocked,
        vaultSalt: cloudUser?.vaultSalt ?? profile.vaultSalt,
        privacyMode: cloudUser?.privacyMode ?? profile.privacyMode,
        biometricCredId: cloudUser?.biometricCredId ?? profile.biometricCredId,
        biometricCredIds: Array.from(
          new Set([
            ...(cloudUser?.biometricCredIds || []),
            ...(profile.biometricCredIds || []),
            ...(cloudUser?.biometricCredId ? [cloudUser.biometricCredId] : []),
            ...(profile.biometricCredId ? [profile.biometricCredId] : []),
          ]),
        ).filter(Boolean),
        devices: Array.from(
          new Set([...(cloudUser?.devices || []), ...(profile.devices || [])]),
        ),
      };

      StorageService.saveProfile(newProfile);

      // Attempt migration if guest
      try {
        await StorageService.migrateLegacyData(newProfile.id!);
        window.location.reload();
        return;
      } catch (e) {
        console.error("Migration failed", e);
      }

      setProfile(newProfile);
    } catch (error) {
      console.error("Authentication failed", error);
    } finally {
      setIsAuthLoading(false);
      setAuthStatus(null);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    scope:
      "openid profile email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly",
    flow: "auth-code",
  });

  const emailLogin = async (email: string, pass: string) => {
    if (!SheetService.isClientReady()) {
      throw new Error(
        "Please connect Google first to access your secure vault.",
      );
    }
    const user = await SheetService.findUser(email);
    if (!user) throw new Error("Account not found.");

    const isValid = await verifyPassword(pass, user.password);
    if (!isValid) throw new Error("Invalid password.");

    const newProfile: UserProfile = {
      ...profile,
      id: user.email,
      name: user.name,
      email: user.email,
      isLoggedIn: true,
      isVaultEnabled: user.isVaultEnabled ?? profile.isVaultEnabled,
      isVaultCreated: user.isVaultCreated ?? profile.isVaultCreated,
      isVaultLocked: user.isVaultLocked ?? profile.isVaultLocked,
      vaultSalt: user.vaultSalt ?? profile.vaultSalt,
      privacyMode: user.privacyMode ?? profile.privacyMode,
      biometricCredId: user.biometricCredId ?? profile.biometricCredId,
      biometricCredIds: Array.from(
        new Set([
          ...(user.biometricCredIds || []),
          ...(profile.biometricCredIds || []),
          ...(user.biometricCredId ? [user.biometricCredId] : []),
          ...(profile.biometricCredId ? [profile.biometricCredId] : []),
        ]),
      ).filter(Boolean),
      devices: Array.from(
        new Set([...(user.devices || []), ...(profile.devices || [])]),
      ),
    };
    StorageService.saveProfile(newProfile);
    setProfile(newProfile);
  };

  const emailSignup = async (email: string, pass: string, name: string) => {
    if (!SheetService.isClientReady()) {
      throw new Error(
        "Please connect Google first to initialize your secure vault.",
      );
    }
    const existing = await SheetService.findUser(email);
    if (existing) throw new Error("Account already exists.");

    const hashedPassword = await hashPassword(pass);
    const success = await SheetService.createUser({
      email,
      password: hashedPassword,
      name,
    });
    if (!success) throw new Error("Failed to write to Google Sheets.");
    await emailLogin(email, pass);
  };

  const loginOffline = () => {
    const offlineProfile: UserProfile = {
      id: "offline_user",
      name: "Local User",
      email: "local@zenfinance",
      isLoggedIn: true,
      offlineMode: true,
    };
    StorageService.saveProfile(offlineProfile);
    setProfile(offlineProfile);
    // No need for reload, state update is enough
  };

  const unlinkCloud = () => {
    SheetService.clearGapiAccessToken();
    // Use the existing updater to ensure storage is also updated
    const p = { ...profile, offlineMode: true };
    setProfile(p);
    StorageService.saveProfile(p);
  };

  const logout = () => {
    googleLogout();
    SheetService.clearGapiAccessToken();
    localStorage.removeItem("vault_password_session");
    sessionStorage.removeItem("vault_password_session");
    const emptyProfile: UserProfile = {
      name: "",
      email: "",
      isLoggedIn: false,
    };
    setProfile(emptyProfile);
    StorageService.saveProfile(emptyProfile);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        loginWithGoogle,
        emailLogin,
        emailSignup,
        logout,
        loginOffline,
        unlinkCloud,
        isInitialized,
        authStatus,
        isAuthLoading,
        updateProfile: async (u, skipCloud = false) => {
          const p = { ...profile, ...u };
          setProfile(p);
          StorageService.saveProfile(p);

          // Sync with Google Sheets if logged in and ready
          if (!skipCloud && SheetService.isClientReady() && p.email) {
            try {
              await SheetService.updateUser(p.email, u);
            } catch (err) {
              console.warn("Failed to sync profile update to sheets", err);
            }
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
