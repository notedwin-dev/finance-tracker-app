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
    }

    SheetService.initGapiClient().then(() => {
      const savedToken = localStorage.getItem("google_access_token");
      const savedExpiry = localStorage.getItem("google_token_expiry");
      if (savedToken) {
        const expiresIn = savedExpiry ? (parseInt(savedExpiry) - Date.now()) / 1000 : undefined;
        SheetService.setGapiAccessToken(savedToken, expiresIn);
      }
      setIsInitialized(true);
    });
  }, []);

  const loginFlow = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // 1. Set Access Token for Sheets API
      SheetService.setGapiAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
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

        // 2. MIGRATION: Move any data created while "Logged Out" (Guest) into this account
        try {
          // Pass the user ID to migrate Guest data into the user-specific storage
          await StorageService.migrateLegacyData(newProfile.id!);

          // CRITICAL: After migration, we MUST reload the page or force the app to
          // re-initialize with the new user-specific keys.
          window.location.reload();
          return; // Stop further execution as page is reloading
        } catch (e) {
          console.error("Migration failed", e);
        }

        // 3. Pull latest data from cloud (New Device Login support)
        try {
          // Initialize GAPI client if not already (safeguard)
          if (
            typeof window.gapi !== "undefined" &&
            !SheetService.isClientReady()
          ) {
            await SheetService.initGapiClient();
          }
          // Re-set user and token to be absolutely sure
          SheetService.setSheetUser(newProfile.id!);
          SheetService.setGapiAccessToken(tokenResponse.access_token);

          const cloudData = await SheetService.loadFromGoogleSheets();
          if (cloudData) {
            // MERGE instead of REPLACE to prevent data loss if cloud is empty
            const local = {
              accounts: StorageService.getStoredAccounts(),
              transactions: StorageService.getStoredTransactions(),
              categories: StorageService.getStoredCategories(),
              goals: StorageService.getStoredGoals(),
              subscriptions: StorageService.getStoredSubscriptions(),
              pots: StorageService.getStoredPots(),
            };

            const merge = <T extends { id: string; updatedAt?: number }>(
              l: T[],
              c: T[],
            ): T[] => {
              const map = new Map<string, T>();
              c.forEach((i) => map.set(i.id, i));
              l.forEach((i) => {
                const cloudItem = map.get(i.id);
                if (
                  !cloudItem ||
                  (i.updatedAt || 0) > (cloudItem.updatedAt || 0)
                ) {
                  map.set(i.id, i);
                }
              });
              return Array.from(map.values());
            };

            StorageService.saveLocalData({
              accounts: merge(local.accounts, cloudData.accounts),
              transactions: merge(local.transactions, cloudData.transactions),
              categories: merge(local.categories, cloudData.categories),
              goals: merge(local.goals, cloudData.goals),
              subscriptions: merge(
                local.subscriptions,
                cloudData.subscriptions,
              ),
              pots: merge(local.pots, cloudData.pots),
            });
            console.log("Merged cloud data with local data on login");
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
    // Adding prompt: 'consent' is usually what causes frequent re-logins. 
    // If we remove it or use default, it might be smoother. 
    // But to truly "Stay Signed In", we should occasionally try a silent re-auth.
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    onError: (errorResponse) => console.error(errorResponse),
  });

  // Watch for token expiry and potentially warn or refresh
  useEffect(() => {
    if (!profile.isLoggedIn) return;

    const checkToken = () => {
      if (!SheetService.isClientReady()) {
        console.warn("Session token expired, needs refresh.");
        // We don't force logout, we just let the UI handle the 'Not Synced' state
      }
    };

    const interval = setInterval(checkToken, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [profile.isLoggedIn]);

  const updateProfile = (updates: Partial<UserProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    StorageService.saveProfile(newProfile);
  };

  const logout = () => {
    // 1. Clear GAPI session
    SheetService.clearGapiAccessToken();

    // 2. Clear profile, but DON'T clear Google session purely if we want to allow 'Switch Account'
    const emptyProfile: UserProfile = {
      name: "",
      email: "",
      isLoggedIn: false,
      id: undefined,
    };
    setProfile(emptyProfile);
    StorageService.saveProfile(emptyProfile);

    // 3. Force reload to reset all states and clear 'guest' data from memory
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
