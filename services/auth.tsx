import React, { createContext, useContext, useEffect, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import * as SheetService from "./sheets";
import * as StorageService from "./storage";
import { UserProfile } from "../types";
import { hashPassword, verifyPassword } from "./crypto";

interface AuthContextType {
  profile: UserProfile;
  loginWithGoogle: () => void;
  emailLogin: (email: string, pass: string) => Promise<void>;
  emailSignup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<UserProfile>(
    StorageService.getStoredProfile(),
  );
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize GAPI client on mount
  useEffect(() => {
    if (profile.id) {
      SheetService.setSheetUser(profile.id);
    }

    SheetService.initGapiClient().then(() => {
      const savedToken = localStorage.getItem("google_access_token");
      const savedExpiry = localStorage.getItem("google_token_expiry");
      if (savedToken) {
        const expiresAt = savedExpiry ? parseInt(savedExpiry) : 0;
        const now = Date.now();
        if (now < expiresAt - 300000) {
          // Valid for at least 5 mins
          SheetService.setGapiAccessToken(savedToken, (expiresAt - now) / 1000);
        }
      }
      setIsInitialized(true);
    });
  }, []);

  const handleGoogleSuccess = async (tokenResponse: any) => {
    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
    SheetService.setGapiAccessToken(
      tokenResponse.access_token,
      tokenResponse.expires_in,
    );
    localStorage.setItem("google_access_token", tokenResponse.access_token);
    localStorage.setItem("google_token_expiry", expiresAt.toString());

    try {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        },
      );
      const userInfo = await userInfoRes.json();

      SheetService.setSheetUser(userInfo.sub || userInfo.email);

      const newProfile: UserProfile = {
        ...profile,
        id: userInfo.sub || userInfo.email,
        name: userInfo.name,
        email: userInfo.email,
        photoUrl: userInfo.picture,
        isLoggedIn: true,
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
      console.error("User info fetch failed", error);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
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
    };
    StorageService.saveProfile(newProfile);
    setProfile(newProfile);
    window.location.reload();
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

  const logout = () => {
    SheetService.clearGapiAccessToken();
    const emptyProfile: UserProfile = {
      name: "",
      email: "",
      isLoggedIn: false,
    };
    setProfile(emptyProfile);
    StorageService.saveProfile(emptyProfile);
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        loginWithGoogle,
        emailLogin,
        emailSignup,
        logout,
        updateProfile: (u) => {
          const p = { ...profile, ...u };
          setProfile(p);
          StorageService.saveProfile(p);
        },
        isInitialized,
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
