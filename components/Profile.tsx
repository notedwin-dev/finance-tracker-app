import React, { useState } from "react";
import { UserProfile } from "../types";
import {
  UserCircleIcon,
  PencilIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  InboxArrowDownIcon,
  KeyIcon,
  TagIcon,
  CalendarDaysIcon,
  DocumentArrowDownIcon,
  SparklesIcon,
  LockClosedIcon,
  FingerPrintIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { useData } from "../context/DataContext";
import * as SecurityService from "../services/security.services";

interface Props {
  profile: UserProfile;
  onLogin: () => void;
  onLogout: () => void;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onManageCategories?: () => void;
  onManageSubscriptions?: () => void;
  onExport?: () => void;
  onMigrate?: () => void;
  onSync?: () => void;
  onResetSync?: () => void;
  isSyncing?: boolean;
}

const Profile: React.FC<Props> = ({
  profile,
  onLogin,
  onLogout,
  onUpdate,
  onManageCategories,
  onManageSubscriptions,
  onExport,
  onMigrate,
  onSync,
  onResetSync,
  isSyncing = false,
}) => {
  const {
    maskText,
    isVaultEnabled,
    isVaultCreated,
    isVaultUnlocked,
    unlockVault,
    enableVault,
    disableVault,
    showToast,
  } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [vaultPass, setVaultPass] = useState("");
  const [showVaultPrompt, setShowVaultPrompt] = useState(false);
  const [showBiometricManagement, setShowBiometricManagement] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);

  const handleSave = () => {
    onUpdate({ name });
    setIsEditing(false);
  };

  const SettingItem = ({
    icon: Icon,
    label,
    description,
    onClick,
    action,
    color = "text-gray-400",
  }: {
    icon: any;
    label: string;
    description?: string;
    onClick?: () => void;
    action?: React.ReactNode;
    color?: string;
  }) => (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer ${
        onClick ? "" : "cursor-default"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {description && (
            <p className="text-[11px] text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        {onClick && !action && (
          <ChevronRightIcon className="w-4 h-4 text-gray-600" />
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-4 pt-6 pb-2">
      {title}
    </h3>
  );

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto animate-fadeIn pb-20">
      {/* Vault Modal */}
      {showVaultPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface w-full max-w-sm rounded-3xl border border-gray-800 shadow-2xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
                <LockClosedIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white">
                {isVaultCreated
                  ? isVaultUnlocked
                    ? "Vault Active"
                    : "Unlock Vault"
                  : "Enable Secure Vault"}
              </h3>
              <p className="text-sm text-gray-500">
                {isVaultCreated
                  ? isVaultUnlocked
                    ? "Your Secure Vault is active and protecting your sensitive data."
                    : "Enter the custom encryption password you created. This is NOT your Google password."
                  : "Create a custom encryption password to protect your bank details. ZenFinance and Google do not have access to this password, so make sure to remember it!"}
              </p>
            </div>

            <div className="space-y-4">
              {(!isVaultEnabled || !isVaultUnlocked) && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-1">
                    Vault Password
                  </label>
                  <input
                    type="password"
                    value={vaultPass}
                    onChange={(e) => {
                      setVaultPass(e.target.value);
                      setVaultError("");
                    }}
                    placeholder="Enter password..."
                    className="w-full bg-card border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    autoFocus
                  />
                  {vaultError && (
                    <p className="text-[10px] text-rose-500 font-bold pl-1">
                      {vaultError}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                {isVaultEnabled &&
                  !isVaultUnlocked &&
                  (SecurityService.isBiometricRegistered() ||
                    profile.biometricCredId) && (
                    <button
                      disabled={isSyncingLocal}
                      onClick={async () => {
                        const verified =
                          await SecurityService.verifyWithBiometrics(
                            profile.biometricCredId,
                          );
                        if (verified) {
                          setIsSyncingLocal(true);
                          setVaultError("");
                          // If we have the ID but not in local storage, register this device locally
                          if (
                            profile.biometricCredId &&
                            !localStorage.getItem("biometric_cred_id")
                          ) {
                            localStorage.setItem(
                              "biometric_cred_id",
                              profile.biometricCredId,
                            );
                          }

                          const storedPass = localStorage.getItem(
                            "vault_password_remembered",
                          );
                          if (storedPass) {
                            try {
                              const success = await unlockVault(storedPass);
                              if (success) {
                                showToast(
                                  "Vault unlocked with Biometrics!",
                                  "success",
                                );
                                setShowVaultPrompt(false);
                              } else {
                                setVaultError(
                                  "Biometric unlock failed. Please use password.",
                                );
                              }
                            } catch (e) {
                              setVaultError("Unlock failed. Please try again.");
                            }
                          } else {
                            setVaultError(
                              "Biometrics verified! However, since this is a new device, please enter your Vault Password once to link your security.",
                            );
                          }
                          setIsSyncingLocal(false);
                        }
                      }}
                      className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
                    >
                      {isSyncingLocal ? (
                        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FingerPrintIcon className="w-5 h-5 text-emerald-400" />
                      )}
                      {isSyncingLocal ? "Processing..." : "Unlock with Biometrics"}
                    </button>
                  )}
                {!isVaultCreated ? (
                  <button
                    disabled={isSyncingLocal}
                    onClick={async () => {
                      if (vaultPass.length < 4) {
                        setVaultError("Password too short");
                        return;
                      }
                      setIsSyncingLocal(true);
                      try {
                        await enableVault(vaultPass);
                        setVaultPass("");
                        setShowVaultPrompt(false);
                        showToast("Vault enabled!", "success");
                      } catch (e) {
                        setVaultError("Failed to enable vault.");
                      } finally {
                        setIsSyncingLocal(false);
                      }
                    }}
                    className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSyncingLocal ? "Setting up..." : "Setup Vault Password"}
                  </button>
                ) : !isVaultUnlocked ? (
                  <button
                    disabled={isSyncingLocal}
                    onClick={async () => {
                      setIsSyncingLocal(true);
                      setVaultError("");
                      try {
                        const success = await unlockVault(vaultPass);
                        if (success) {
                          // Link biometrics to this password for future usage on this device
                          if (
                            SecurityService.isBiometricRegistered() ||
                            profile.biometricCredId
                          ) {
                            localStorage.setItem(
                              "vault_password_remembered",
                              vaultPass,
                            );
                            if (
                              profile.biometricCredId &&
                              !localStorage.getItem("biometric_cred_id")
                            ) {
                              localStorage.setItem(
                                "biometric_cred_id",
                                profile.biometricCredId,
                              );
                            }
                          }

                          // If it was created but currently disabled, enable it
                          if (!isVaultEnabled) {
                            await enableVault(vaultPass);
                          }
                          setVaultPass("");
                          showToast("Vault unlocked!", "success");
                          setShowVaultPrompt(false);
                        } else {
                          setVaultError("Invalid password");
                        }
                      } catch (e) {
                        setVaultError("Unlock error.");
                      } finally {
                        setIsSyncingLocal(false);
                      }
                    }}
                    className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSyncingLocal
                      ? "Verifying..."
                      : isVaultEnabled
                        ? "Unlock Vault"
                        : "Unlock & Enable Vault"}
                  </button>
                ) : (
                  <button
                    disabled={isSyncingLocal}
                    onClick={async () => {
                      setIsSyncingLocal(true);
                      try {
                        await disableVault();
                        setShowVaultPrompt(false);
                        showToast("Vault disabled", "info");
                      } finally {
                        setIsSyncingLocal(false);
                      }
                    }}
                    className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSyncingLocal ? "Disabling..." : "Disable Vault"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowVaultPrompt(false);
                    setVaultPass("");
                    setVaultError("");
                  }}
                  className="w-full bg-gray-900 text-gray-500 font-bold py-3 rounded-xl active:scale-[0.98] transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Management Modal */}
      {showBiometricManagement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface w-full max-w-sm rounded-3xl border border-gray-800 shadow-2xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-4">
                <FingerPrintIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white">Manage Passkeys</h3>
              <p className="text-sm text-gray-500">
                Register this device to access your vault instantly.
                <br />
                <span className="text-[10px] text-gray-600 mt-2 block italic">
                  Note: Passkeys are tied to domains. If you registered on a
                  different domain (e.g. localhost), you must register again for{" "}
                  {window.location.host}.
                </span>
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  const credId = await SecurityService.registerBiometrics(
                    profile.name,
                  );
                  if (credId) {
                    const currentPass = localStorage.getItem(
                      "vault_password_session",
                    );
                    if (currentPass) {
                      localStorage.setItem(
                        "vault_password_remembered",
                        currentPass,
                      );
                    }
                    onUpdate({ biometricCredId: credId });
                    showToast("New Passkey registered!", "success");
                    setShowBiometricManagement(false);
                  } else {
                    showToast(
                      "Registration failed. Note: Passkeys are domain-specific.",
                      "alert",
                    );
                  }
                }}
                className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <FingerPrintIcon className="w-5 h-5" />
                Register This Device
              </button>

              {(SecurityService.isBiometricRegistered() ||
                profile.biometricCredId) && (
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        "Unlink security? You will need your vault password to unlock next time.",
                      )
                    ) {
                      localStorage.removeItem("biometric_cred_id");
                      localStorage.removeItem("vault_password_remembered");
                      onUpdate({ biometricCredId: "" });
                      showToast("Security links removed", "info");
                      setShowBiometricManagement(false);
                    }
                  }}
                  className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all"
                >
                  Unlink All Passkeys
                </button>
              )}

              <button
                onClick={() => setShowBiometricManagement(false)}
                className="w-full bg-gray-900 text-gray-500 font-bold py-3 rounded-xl active:scale-[0.98] transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {profile.isLoggedIn ? (
        <div className="w-full space-y-2">
          {/* Profile Header */}
          <div className="bg-surface sm:rounded-3xl border border-gray-800 overflow-hidden mb-6">
            <div className="h-24 bg-linear-to-r from-primary/20 to-secondary/20 relative">
              <div className="absolute -bottom-12 left-6">
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-2xl border-4 border-surface shadow-xl"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-4 border-surface bg-slate-800 flex items-center justify-center text-4xl shadow-xl">
                    👤
                  </div>
                )}
              </div>
            </div>

            <div className="pt-16 pb-6 px-6">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-card text-xl font-bold text-white border-b-2 border-primary focus:outline-none py-1 flex-1"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg font-bold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                      {maskText(profile.name)}
                      <button
                        onClick={() => {
                          setName(profile.name);
                          setIsEditing(true);
                        }}
                        className="text-gray-500 hover:text-primary transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                      {maskText(profile.email)}
                    </p>
                  </div>
                  <div className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider border border-primary/20">
                    Free Forever
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface sm:rounded-3xl border border-gray-800 divide-y divide-gray-800/50 overflow-hidden">
            <SectionHeader title="App Preferences" />
            <SettingItem
              icon={EyeSlashIcon}
              label="Privacy Mode"
              description="Mask balances and text throughout the app"
              color="text-indigo-400"
              action={
                <button
                  onClick={() =>
                    onUpdate({ privacyMode: !profile.privacyMode })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    profile.privacyMode ? "bg-primary" : "bg-gray-800"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      profile.privacyMode ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              }
            />

            <SectionHeader title="Security & Biometrics" />
            <SettingItem
              icon={LockClosedIcon}
              label="Secure Vault"
              description={
                isVaultCreated
                  ? isVaultUnlocked
                    ? "Vault is unlocked and active"
                    : isVaultEnabled
                      ? "Vault is locked. Tap to unlock."
                      : "Vault is disabled. Tap to enable."
                  : "Enable a Secure Vault to protect sensitive details."
              }
              color={isVaultEnabled ? "text-rose-400" : "text-gray-400"}
              onClick={() => setShowVaultPrompt(true)}
              action={
                isVaultEnabled ? (
                  <div
                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${isVaultUnlocked ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                  >
                    {isVaultUnlocked ? "Unlocked" : "Locked"}
                  </div>
                ) : (
                  <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-gray-800 text-gray-500">
                    Off
                  </div>
                )
              }
            />
            <SettingItem
              icon={FingerPrintIcon}
              label={
                SecurityService.isBiometricRegistered()
                  ? "Passkey Active"
                  : profile.biometricCredId
                    ? "Passkey Available"
                    : "Register Passkey"
              }
              description={
                SecurityService.isBiometricRegistered()
                  ? "Device identity linked"
                  : profile.biometricCredId
                    ? "Stored in cloud (sync available)"
                    : "Use TouchID/FaceID for secure reveal"
              }
              color={
                SecurityService.isBiometricRegistered()
                  ? "text-indigo-400"
                  : profile.biometricCredId
                    ? "text-blue-400"
                    : "text-emerald-400"
              }
              onClick={() => setShowBiometricManagement(true)}
            />
            {onManageCategories && (
              <SettingItem
                icon={TagIcon}
                label="Categories"
                description="Custom labels for your money flow"
                onClick={onManageCategories}
                color="text-indigo-400"
              />
            )}
            {onManageSubscriptions && (
              <SettingItem
                icon={CalendarDaysIcon}
                label="Subscriptions"
                description="Track and manage recurring payments"
                onClick={onManageSubscriptions}
                color="text-emerald-400"
              />
            )}

            <SectionHeader title="Cloud & Data" />
            {onSync && (
              <SettingItem
                icon={CloudArrowUpIcon}
                label="Cloud Synchronization"
                description={
                  isSyncing ? "Syncing now..." : "Backup to Google Sheets"
                }
                onClick={onSync}
                color="text-sky-400"
                action={
                  isSyncing ? (
                    <ArrowPathIcon className="w-4 h-4 text-sky-400 animate-spin" />
                  ) : null
                }
              />
            )}
            {onResetSync && (
              <SettingItem
                icon={ArrowPathIcon}
                label="Force Cloud Restore"
                description="Clear cache and re-download data"
                onClick={onResetSync}
                color="text-amber-400"
              />
            )}
            {onMigrate && (
              <SettingItem
                icon={InboxArrowDownIcon}
                label="Import Data"
                description="Recover data from browser storage"
                onClick={onMigrate}
                color="text-purple-400"
              />
            )}
            <SettingItem
              icon={DocumentArrowDownIcon}
              label="Export Backup"
              description="Download all data as JSON"
              onClick={onExport}
              color="text-gray-400"
            />

            <SectionHeader title="AI Assistant" />
            <SettingItem
              icon={SparklesIcon}
              label="Show Assistant"
              description="Enable floating AI toggle"
              color="text-fuchsia-400"
              action={
                <button
                  onClick={() =>
                    onUpdate({ showAIAssistant: !profile.showAIAssistant })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    profile.showAIAssistant ? "bg-primary" : "bg-gray-800"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      profile.showAIAssistant ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              }
            />
            <SettingItem
              icon={CloudArrowUpIcon}
              label="Sync Chats to Cloud"
              description="Backup conversations to Google Sheets"
              color="text-indigo-400"
              action={
                <button
                  onClick={() =>
                    onUpdate({ syncChatToSheets: !profile.syncChatToSheets })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    profile.syncChatToSheets ? "bg-primary" : "bg-gray-800"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      profile.syncChatToSheets ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              }
            />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
                  <KeyIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Gemini API Key
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Required for AI financial insights
                  </p>
                </div>
              </div>
              <input
                type="password"
                value={profile.geminiApiKey || ""}
                onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
                placeholder="Enter your API Key"
                className="w-full bg-background border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
              />
              <p className="text-[10px] text-gray-600 px-1">
                Your key is encrypted and stored locally on this device.
              </p>
            </div>

            <SectionHeader title="Danger Zone" />
            <div
              onClick={onLogout}
              className="flex items-center gap-4 p-4 hover:bg-red-500/5 active:bg-red-500/10 transition-colors cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500/20">
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-500">Sign Out</p>
                <p className="text-[11px] text-red-500/60 font-medium">
                  End your current session
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary">
            <UserCircleIcon className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Welcome to ZenFinance
            </h2>
            <p className="text-gray-400">
              Sign in to sync your budgets across devices.
            </p>
          </div>

          <button
            onClick={onLogin}
            className="flex items-center justify-center gap-3 w-full bg-white text-gray-900 font-bold py-4 rounded-xl hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
