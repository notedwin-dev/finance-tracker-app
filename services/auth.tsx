import React, { createContext, useContext, useEffect, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import * as SheetService from "./sheets";
import * as StorageService from "./storage";
import { UserProfile } from "../types";

interface AuthContextType {
  profile: UserProfile;
  login: () => void;
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

      // Attempt to restore token from localStorage for auto-sync
      const savedToken = localStorage.getItem("google_access_token");
      if (savedToken) {
        SheetService.setGapiAccessToken(savedToken);
      }
    }
    SheetService.initGapiClient().then(() => setIsInitialized(true));
  }, []);

  const loginFlow = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // 1. Set Access Token for Sheets API
      SheetService.setGapiAccessToken(tokenResponse.access_token);
      localStorage.setItem("google_access_token", tokenResponse.access_token);

      // 2. Fetch User Profile Info (optional, using standard Google UserInfo endpoint)
      try {
        const userInfoRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          },
        );
        const userInfo = await userInfoRes.json();

        // Separate Sheet for User
        SheetService.setSheetUser(userInfo.sub || userInfo.email);

        const newProfile: UserProfile = {
          ...profile,
          id: userInfo.sub || userInfo.email,
          name: userInfo.name,
          email: userInfo.email,
          photoUrl: userInfo.picture,
          isLoggedIn: true,
        };

        // 1. Save Profile (Critical for StorageService.getKey to work for this user)
        StorageService.saveProfile(newProfile);

        // 2. Pull latest data from cloud (New Device Login support)
        try {
          // Initialize GAPI client if not already (safeguard)
          if (
            typeof window.gapi !== "undefined" &&
            !SheetService.isClientReady()
          ) {
            await SheetService.initGapiClient();
            SheetService.setGapiAccessToken(tokenResponse.access_token);
          }

          const cloudData = await SheetService.loadFromGoogleSheets();
          if (cloudData) {
            StorageService.saveLocalData(cloudData);
            console.log("Synced data from cloud on login");
          }
        } catch (e) {
          console.warn("Failed to sync data on login", e);
        }

        // 3. Update State (Triggers App re-render and loadData)
        setProfile(newProfile);
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    },
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    onError: (errorResponse) => console.error(errorResponse),
  });

  const updateProfile = (updates: Partial<UserProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    StorageService.saveProfile(newProfile);
  };

  const logout = () => {
    const emptyProfile = { name: "", email: "", isLoggedIn: false };
    setProfile(emptyProfile);
    StorageService.saveProfile(emptyProfile);
    // Note: We can't strictly 'revoke' the token client-side purely with this library easily without calling another endpoint,
    // but clearing local state is sufficient for the UI.
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        login: loginFlow,
        logout,
        updateProfile,
        isInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
