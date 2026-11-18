import React, { createContext, useContext, useEffect, useState } from "react";
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import * as SheetService from "./sheets.services";
import * as StorageService from "./storage.services";
import { UserProfile } from "../types";
import { hashPassword, verifyPassword } from "./crypto.services";
import { parseStoredExpiry } from "../helpers/sheets.helper";

// Legacy vault profile type for backward compatibility
type LegacyVaultProfile = UserProfile & {
	isVaultEnabled?: boolean;
	isVaultCreated?: boolean;
	isVaultLocked?: boolean;
	vaultSalt?: string;
	encryptedVaultPassword?: string;
	biometricCredId?: string;
	biometricCredIds?: string[];
	devices?: any[];
};

interface AuthContextType {
	profile: UserProfile;
	loginWithGoogle: () => void;
	refreshTokenSilently: () => Promise<string | null>;
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
	import.meta.env.VITE_BACKEND_API_URL || "";

/**
 * Exchange a refresh token for a new access token. Resolves null ONLY on a
 * parsed OAuth auth failure (invalid/revoked refresh token or client); THROWS
 * on everything else — network, 5xx/429, malformed body, or a tokenless
 * response with no recognised auth error — so callers keep the current
 * session instead of clearing it on an ambiguous backend reply.
 */
export const exchangeRefreshToken = async (
	refreshToken: string,
	backendUrl: string,
): Promise<string | null> => {
	let res: Response;
	try {
		res = await fetch(`${backendUrl}/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refreshToken }),
		});
	} catch (e) {
		console.error("Token refresh failed", e);
		throw e;
	}
	if (res.status === 429 || res.status >= 500) {
		throw new Error(`Token refresh backend error: ${res.status}`);
	}
	let data: any;
	try {
		data = await res.json();
	} catch (e) {
		// e.g. an HTML error page from a misconfigured backend URL
		throw e;
	}
	if (data?.access_token) return data.access_token;
	// Only these OAuth errors mean the session is genuinely unrecoverable.
	// A tokenless 200, or a protocol error like invalid_request, is ambiguous
	// and must throw so the access token is preserved.
	const authError =
		typeof data?.error === "string" &&
		(data.error === "invalid_grant" ||
			data.error === "invalid_client" ||
			data.error === "unauthorized_client");
	if (authError) return null;
	throw new Error(
		`Token refresh failed: ${data?.error ?? "no access token in response"}`,
	);
};

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

		const token = await exchangeRefreshToken(refreshToken, BACKEND_URL);
		if (token) {
			const expiresAt = Date.now() + 3500 * 1000; // Assume ~1hr
			SheetService.setGapiAccessToken(token, 3600);
			localStorage.setItem("google_access_token", token);
			localStorage.setItem("google_token_expiry", expiresAt.toString());
		}
		return token;
	};

	// Initialize GAPI client on mount
	useEffect(() => {
		if (profile.id) {
			SheetService.setSheetUser(profile.id);
		}

		// The Sheets layer can recover an expired session without a re-auth
		// dance; registered here because silent refresh needs the backend URL.
		SheetService.setAuthRefreshHandler(refreshAccessToken);

		const initAuth = async () => {
			await SheetService.initGapiClient();

			const savedToken = localStorage.getItem("google_access_token");
			const savedExpiry = localStorage.getItem("google_token_expiry");
			const refreshToken = localStorage.getItem("google_refresh_token");

			let token = savedToken;
			// "NaN"/garbage stored expiry (historical bug) parses as 0 = unknown,
			// so the refresh condition below now actually fires and heals boot.
			let expiry = parseStoredExpiry(savedExpiry);

			if (refreshToken && (!token || Date.now() > expiry - 300000)) {
				try {
					token = await refreshAccessToken();
				} catch {
					// Transient backend/network failure: boot on the saved
					// token (or local data) instead of wedging initialization.
					token = null;
				}
			} else if (token) {
				SheetService.setGapiAccessToken(token, (expiry - Date.now()) / 1000);
			}

			setIsInitialized(true);
		};

		initAuth();

		return () => {
			SheetService.setAuthRefreshHandler(null);
		};
	}, []);

	const handleGoogleSuccess = async ({ code }: { code: string }) => {
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
			// Guard the expiry write: a missing/garbage expires_in used to
			// persist "NaN" here, which permanently masked every future
			// token expiry and broke boot refresh.
			const expiresIn =
				typeof tokens.expires_in === "number" &&
				isFinite(tokens.expires_in) &&
				tokens.expires_in > 0
					? tokens.expires_in
					: 3600; // Google access tokens live ~1 hour
			const expiresAt = Date.now() + expiresIn * 1000;
			SheetService.setGapiAccessToken(tokens.access_token, expiresIn);

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
			const legacyProfile = profile as LegacyVaultProfile;
			const newProfile: UserProfile = {
				...profile,
				id: userId,
				name: userInfo.name,
				email: userInfo.email,
				photoUrl: userInfo.picture,
				isLoggedIn: true,
				offlineMode: false,
				// Sync cloud settings if they exist
				isSecurityEnabled:
					cloudUser?.isSecurityEnabled ?? profile.isSecurityEnabled,
				totpSecret: cloudUser?.totpSecret ?? profile.totpSecret,
				totpEnabled: cloudUser?.totpEnabled ?? profile.totpEnabled,
				privacyMode: cloudUser?.privacyMode ?? profile.privacyMode,
				...({
					isVaultEnabled:
						cloudUser?.isSecurityEnabled ?? legacyProfile.isVaultEnabled,
					isVaultCreated:
						cloudUser?.isSecurityEnabled ?? legacyProfile.isVaultCreated,
					isVaultLocked:
						cloudUser?.isVaultLocked ?? legacyProfile.isVaultLocked,
				} as any),
				biometricCredIds: Array.from(
					new Set([
						...(cloudUser?.biometricCredIds || []),
						...(profile.biometricCredIds || []),
					]),
				).filter(Boolean),
				devices: Array.from(
					new Set([...(cloudUser?.devices || []), ...(profile.devices || [])]),
				),
				geminiApiKey: cloudUser?.geminiApiKey ?? profile.geminiApiKey ?? "",
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
		scope: "openid profile email https://www.googleapis.com/auth/drive.file",
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

		const legacyProfile = profile as LegacyVaultProfile;
		const newProfile: UserProfile = {
			...profile,
			id: user.email,
			name: user.name,
			email: user.email,
			isLoggedIn: true,
			isSecurityEnabled: user.isSecurityEnabled ?? profile.isSecurityEnabled,
			totpSecret: user.totpSecret ?? profile.totpSecret,
			totpEnabled: user.totpEnabled ?? profile.totpEnabled,
			privacyMode: user.privacyMode ?? profile.privacyMode,
			...({
				isVaultEnabled: user.isSecurityEnabled ?? legacyProfile.isVaultEnabled,
				isVaultCreated: user.isSecurityEnabled ?? legacyProfile.isVaultCreated,
				isVaultLocked: user.isVaultLocked ?? legacyProfile.isVaultLocked,
			} as any),
			biometricCredIds: Array.from(
				new Set([
					...(user.biometricCredIds || []),
					...(profile.biometricCredIds || []),
				]),
			).filter(Boolean),
			devices: Array.from(
				new Set([...(user.devices || []), ...(profile.devices || [])]),
			),
			geminiApiKey: user.geminiApiKey ?? profile.geminiApiKey ?? "",
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
				refreshTokenSilently: refreshAccessToken,
				emailLogin,
				emailSignup,
				logout,
				loginOffline,
				unlinkCloud,
				isInitialized,
				authStatus,
				isAuthLoading,
				updateProfile: async (u, skipCloud = false) => {
					let updatedP: UserProfile;
					setProfile((prev) => {
						updatedP = { ...prev, ...u };
						StorageService.saveProfile(updatedP);
						return updatedP;
					});

					// Sync with Google Sheets if logged in and ready
					if (!skipCloud && SheetService.isClientReady() && profile.email) {
						try {
							await SheetService.updateUser(profile.email, u);
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
