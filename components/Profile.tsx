import React, { useState } from "react";
import { UserProfile } from "../types";

// Legacy vault type for backward compatibility
type LegacyVaultProfile = UserProfile & {
	biometricCredId?: string;
	biometricCredIds?: string[];
	devices?: any[];
};

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
	CalculatorIcon,
	ShieldCheckIcon,
	ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { useData } from "../context/DataContext";
import * as SecurityService from "../services/security.services";
import * as TwoFAService from "../services/twofa.services";
import { getDeviceId } from "../services/storage.services";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { GoogleDrivePicker } from "./GoogleDrivePicker";

interface Props {
	profile: UserProfile;
	onLogin: () => void;
	onLogout: () => void;
	onUpdate: (updates: Partial<UserProfile>) => void;
	onManageCategories?: () => void;
	onManageSubscriptions?: () => void;
	onExport?: (startDate?: string, endDate?: string) => void;
	onMigrate?: () => void;
	onSync?: () => void;
	onUnlinkCloud?: () => void;
	onResetSync?: () => void;
	onSelectSheet?: (sheetId: string) => void;
	isSyncing?: boolean;
}

const Profile: React.FC<Props> = ({
	profile: rawProfile,
	onLogin,
	onLogout,
	onUpdate,
	onManageCategories,
	onManageSubscriptions,
	onExport,
	onMigrate,
	onSync,
	onUnlinkCloud,
	onResetSync,
	onSelectSheet,
	isSyncing = false,
}) => {
	// Cast to legacy type for backward compatibility
	const profile = rawProfile as LegacyVaultProfile;

	const {
		maskText,
		isVaultEnabled,
		isVaultCreated,
		isVaultUnlocked,
		unlockVaultWithTOTP,
		unlockVaultWithBiometrics,
		lockVault,
		enableVault,
		disableVault,
		showToast,
		recalculateBalances,
	} = useData();
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState(profile.name);
	const [vaultTOTPCode, setVaultTOTPCode] = useState("");
	const [showVaultPrompt, setShowVaultPrompt] = useState(false);
	const [showTOTPSetup, setShowTOTPSetup] = useState(false);
	const [totpSecret, setTotpSecret] = useState("");
	const [totpQRCode, setTotpQRCode] = useState("");
	const [totpVerifyCode, setTotpVerifyCode] = useState("");
	const [totpError, setTotpError] = useState("");
	const [totpStep, setTotpStep] = useState<"scan" | "verify">("scan");
	const [showBiometricManagement, setShowBiometricManagement] = useState(false);
	const [vaultError, setVaultError] = useState("");
	const [isSyncingLocal, setIsSyncingLocal] = useState(false);
	const [showExportModal, setShowExportModal] = useState(false);
	const [exportStartDate, setExportStartDate] = useState("");
	const [exportEndDate, setExportEndDate] = useState("");
	const [confirmationModal, setConfirmationModal] = useState<{
		isOpen: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
		confirmLabel: string;
		isDestructive?: boolean;
	}>({
		isOpen: false,
		title: "",
		description: "",
		onConfirm: () => {},
		confirmLabel: "Confirm",
	});

	const handleBiometricUnlock = async () => {
		const credId = profile.biometricCredIds?.[0] || profile.biometricCredId;
		if (!credId) return;
		const verified = await SecurityService.verifyWithBiometrics(credId);
		if (verified) {
			setIsSyncingLocal(true);
			setVaultError("");

			// If we are unlocked, don't ask for password again
			if (isVaultUnlocked) {
				setShowVaultPrompt(false);
				setIsSyncingLocal(false);
				showToast("Vault is already unlocked", "info");
				return;
			}

			const storedPass = localStorage.getItem("vault_password_remembered");
			if (storedPass) {
				// Legacy password storage - clear it
				localStorage.removeItem("vault_password_remembered");
				setVaultError("Please use TOTP or biometric unlock");
				setIsSyncingLocal(false);
				return;
			}

			// Try biometric unlock
			try {
				const success = await unlockVaultWithBiometrics();
				if (success) {
					showToast("Vault unlocked with Biometrics!", "success");
					setShowVaultPrompt(false);
				} else {
					setVaultError("Biometric unlock failed. Please use TOTP code.");
				}
			} catch (e) {
				setVaultError("Unlock failed. Please try again.");
			}

			setIsSyncingLocal(false);
		}
	};

	const handleSave = () => {
		onUpdate({ name });
		setIsEditing(false);
	};

	const handleSetupTOTP = async () => {
		const secret = TwoFAService.generateTOTPSecret(profile.email);
		const qrCode = await TwoFAService.generateQRCode(secret, profile.email);
		setTotpSecret(secret);
		setTotpQRCode(qrCode);
		setTotpStep("scan");
		setTotpVerifyCode("");
		setTotpError("");
		setShowTOTPSetup(true);
	};

	const handleVerifyTOTP = () => {
		if (totpVerifyCode.length !== 6) {
			setTotpError("Please enter a 6-digit code");
			return;
		}
		const isValid = TwoFAService.verifyTOTP(totpSecret, totpVerifyCode);
		if (isValid) {
			onUpdate({
				totpSecret,
				totpEnabled: true,
				isSecurityEnabled: true,
			});
			showToast("2FA enabled successfully!", "success");
			setShowTOTPSetup(false);
			setTotpSecret("");
			setTotpQRCode("");
			setTotpVerifyCode("");
			setTotpError("");
		} else {
			setTotpError("Invalid code. Please try again.");
		}
	};

	const handleDisableTOTP = () => {
		setConfirmationModal({
			isOpen: true,
			title: "Disable 2FA?",
			description:
				"This will also disable your vault encryption. Your account will be less secure.",
			confirmLabel: "Disable 2FA",
			isDestructive: true,
			onConfirm: async () => {
				if (isVaultEnabled) {
					await disableVault();
				}
				onUpdate({
					totpSecret: "",
					totpEnabled: false,
					isSecurityEnabled: false,
				});
				showToast("2FA disabled", "info");
			},
		});
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
		onClick?: (props?: any) => void;
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
			{/* Export Backup Modal */}
			<Modal
				isOpen={showExportModal}
				onClose={() => setShowExportModal(false)}
				title="Export Backup"
				maxWidth="max-w-sm"
			>
				<div className="space-y-6">
					<div className="space-y-2">
						<p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
							Select Range (Optional)
						</p>
						<div className="space-y-3">
							<div className="space-y-1">
								<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
									Start Date
								</label>
								<DatePicker
									value={exportStartDate}
									onChange={setExportStartDate}
									placeholder="Earliest"
								/>
							</div>
							<div className="space-y-1">
								<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
									End Date
								</label>
								<DatePicker
									value={exportEndDate}
									onChange={setExportEndDate}
									placeholder="Latest"
								/>
							</div>
						</div>
						<p className="text-[10px] text-gray-600 italic mt-2">
							Note: If no dates are selected, all transactions will be exported.
							Accounts, Categories, and Goals are always included.
						</p>
					</div>

					<div className="flex flex-col gap-2 pt-2">
						<button
							onClick={() => {
								if (onExport) onExport(exportStartDate, exportEndDate);
								setShowExportModal(false);
							}}
							className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
						>
							Download JSON
						</button>
						<button
							onClick={() => {
								setExportStartDate("");
								setExportEndDate("");
							}}
							className="w-full py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
						>
							Reset Filters
						</button>
					</div>
				</div>
			</Modal>

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
										: "Enter your 6-digit 2FA code from your authenticator app to unlock the vault."
									: "Setup requires a TOTP 2FA app (like Google Authenticator). Your vault encryption is tied to your 2FA secret."}
							</p>
						</div>

						<div className="space-y-4">
							{isSyncingLocal ? (
								<div className="flex flex-col items-center justify-center py-8 space-y-4">
									<div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
									<p className="text-gray-400 font-bold text-sm">
										Processing Security Request...
									</p>
								</div>
							) : (
								<>
									{(!isVaultEnabled || !isVaultUnlocked) && (
										<div className="space-y-1.5">
											<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-1">
												2FA Code (6 Digits)
											</label>
											<input
												type="text"
												inputMode="numeric"
												pattern="[0-9]*"
												maxLength={6}
												value={vaultTOTPCode}
												disabled={isSyncingLocal}
												onChange={(e) => {
													const value = e.target.value.replace(/[^0-9]/g, "");
													setVaultTOTPCode(value);
													setVaultError("");
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter" && vaultTOTPCode.length === 6) {
														if (!isVaultCreated) {
															// Setup vault
															document
																.querySelector<HTMLButtonElement>(
																	'[data-action="setup-vault"]',
																)
																?.click();
														} else if (!isVaultUnlocked) {
															// Unlock vault
															document
																.querySelector<HTMLButtonElement>(
																	'[data-action="unlock-vault"]',
																)
																?.click();
														}
													}
												}}
												placeholder="000000"
												className="w-full bg-card border border-gray-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
											(profile.biometricCredIds?.length ||
												profile.biometricCredId) && (
												<button
													disabled={isSyncingLocal}
													onClick={() => {
														setConfirmationModal({
															isOpen: true,
															title: "Biometric Unlock",
															description:
																"Are you sure you want to use TouchID/FaceID to unlock your private vault data?",
															confirmLabel: "Verify Identity",
															onConfirm: handleBiometricUnlock,
														});
													}}
													className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
												>
													<FingerPrintIcon className="w-5 h-5 text-emerald-400" />
													Unlock with Biometrics
												</button>
											)}
										{!isVaultCreated ? (
											<button
												data-action="setup-vault"
												disabled={isSyncingLocal || !profile.totpSecret}
												onClick={async () => {
													if (!profile.totpSecret) {
														setVaultError(
															"TOTP 2FA must be enabled first in Profile settings.",
														);
														return;
													}
													if (vaultTOTPCode.length !== 6) {
														setVaultError(
															"Please enter your current 6-digit 2FA code",
														);
														return;
													}
													setIsSyncingLocal(true);
													try {
														await enableVault();
														setVaultTOTPCode("");
														setShowVaultPrompt(false);

														// Check biometrics availability
														if (
															(await SecurityService.isBiometricAvailable()) &&
															!(
																profile.biometricCredIds?.length ||
																profile.biometricCredId
															)
														) {
															setConfirmationModal({
																isOpen: true,
																title: "Enable Biometrics",
																description:
																	"Would you like to enable TouchID/FaceID for secure reveals on this device?",
																confirmLabel: "Enable Secure Access",
																onConfirm: async () => {
																	const credId =
																		await SecurityService.registerBiometrics(
																			profile.name || "User",
																			profile.biometricCredIds,
																		);
																	if (credId) {
																		// Use the already hashed password from system storage or session
																		const currentHashed =
																			sessionStorage.getItem(
																				"vault_password_session",
																			);
																		if (currentHashed) {
																			localStorage.setItem(
																				"vault_password_remembered",
																				currentHashed,
																			);
																		}
																		onUpdate({
																			biometricCredIds: Array.from(
																				new Set([
																					...(profile.biometricCredIds || []),
																					credId,
																				]),
																			),
																		});
																		showToast(
																			"Vault enabled with Biometrics!",
																			"success",
																		);
																	} else {
																		showToast(
																			"Biometric setup failed, but Vault is enabled.",
																			"alert",
																		);
																	}
																},
															});
														} else {
															showToast("Vault enabled!", "success");
														}
													} catch (e) {
														setVaultError("Failed to enable vault.");
													} finally {
														setIsSyncingLocal(false);
													}
												}}
												className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
											>
												{isSyncingLocal
													? "Setting up..."
													: !profile.totpSecret
														? "Enable 2FA First"
														: "Enable Vault Encryption"}
											</button>
										) : !isVaultUnlocked ? (
											<button
												data-action="unlock-vault"
												disabled={isSyncingLocal || vaultTOTPCode.length !== 6}
												onClick={async () => {
													setIsSyncingLocal(true);
													setVaultError("");
													try {
														const success =
															await unlockVaultWithTOTP(vaultTOTPCode);
														if (success) {
															setVaultTOTPCode("");
															showToast("Vault unlocked!", "success");
															setShowVaultPrompt(false);
														} else {
															setVaultError(
																"Invalid 2FA code. Please try again.",
															);
														}
													} catch (e) {
														setVaultError(
															"Unlock error. Please verify your code.",
														);
													} finally {
														setIsSyncingLocal(false);
													}
												}}
												className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
											>
												{isSyncingLocal
													? "Verifying..."
													: "Unlock with 2FA Code"}
											</button>
										) : (
											<div className="space-y-2 w-full">
												<button
													disabled={isSyncingLocal}
													onClick={() => {
														lockVault();
														setShowVaultPrompt(false);
													}}
													className="w-full bg-surface text-white border border-gray-800 font-black py-4 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
												>
													Lock Vault
												</button>
												<button
													disabled={isSyncingLocal}
													onClick={() => {
														setConfirmationModal({
															isOpen: true,
															title: "Disable Security Vault?",
															description:
																"This will decrypt all your sensitive data and store it unencrypted in your Google Sheet. This is not recommended.",
															confirmLabel: "Disable Encryption",
															isDestructive: true,
															onConfirm: async () => {
																setIsSyncingLocal(true);
																try {
																	await disableVault();
																	setShowVaultPrompt(false);
																	showToast("Vault disabled", "info");
																} finally {
																	setIsSyncingLocal(false);
																}
															},
														});
													}}
													className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
												>
													Disable Vault Entirely
												</button>
											</div>
										)}
										<button
											onClick={() => {
												setShowVaultPrompt(false);
												setVaultTOTPCode("");
												setVaultError("");
											}}
											className="w-full bg-gray-900 text-gray-500 font-bold py-3 rounded-xl active:scale-[0.98] transition-all text-sm"
										>
											Cancel
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* TOTP Setup Modal */}
			{showTOTPSetup && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
					<div className="bg-surface w-full max-w-md rounded-3xl border border-gray-800 shadow-2xl p-6 space-y-6">
						<div className="text-center space-y-2">
							<div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
								<ShieldCheckIcon className="w-8 h-8" />
							</div>
							<h3 className="text-xl font-black text-white">
								{totpStep === "scan" ? "Setup 2FA" : "Verify Setup"}
							</h3>
							<p className="text-sm text-gray-500">
								{totpStep === "scan"
									? "Scan the QR code with your authenticator app"
									: "Enter the 6-digit code from your app to confirm"}
							</p>
						</div>

						{totpStep === "scan" ? (
							<div className="space-y-4">
								{/* QR Code */}
								<div className="bg-white p-6 rounded-2xl mx-auto w-fit">
									{totpQRCode && (
										<img
											src={totpQRCode}
											alt="TOTP QR Code"
											className="w-64 h-64"
										/>
									)}
								</div>

								{/* Manual Entry */}
								<div className="space-y-2">
									<p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">
										Or enter manually
									</p>
									<div className="bg-card border border-gray-800 rounded-xl p-4">
										<p className="text-xs text-gray-500 font-bold mb-2">
											Secret Key:
										</p>
										<div className="flex items-center justify-between gap-2">
											<code className="text-white font-mono text-sm break-all flex-1">
												{totpSecret}
											</code>
											<button
												onClick={() => {
													navigator.clipboard.writeText(totpSecret);
													showToast("Secret copied!", "success");
												}}
												className="text-gray-500 hover:text-white transition-colors shrink-0"
											>
												<ClipboardDocumentIcon className="w-5 h-5" />
											</button>
										</div>
									</div>
								</div>

								{/* Instructions */}
								<div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
									<p className="text-xs text-primary font-bold mb-2">
										Supported Apps:
									</p>
									<ul className="text-xs text-gray-400 space-y-1">
										<li>• Google Authenticator</li>
										<li>• Authy</li>
										<li>• Microsoft Authenticator</li>
										<li>• 1Password</li>
									</ul>
								</div>

								{/* Actions */}
								<div className="flex flex-col gap-2 pt-2">
									<button
										onClick={() => setTotpStep("verify")}
										className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
									>
										I've Scanned the Code
									</button>
									<button
										onClick={() => {
											setShowTOTPSetup(false);
											setTotpSecret("");
											setTotpQRCode("");
											setTotpError("");
										}}
										className="w-full bg-gray-900 text-gray-500 font-bold py-3 rounded-xl active:scale-[0.98] transition-all text-sm"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								{/* Verification Input */}
								<div className="space-y-1.5">
									<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest pl-1">
										Verification Code
									</label>
									<input
										type="text"
										inputMode="numeric"
										pattern="[0-9]*"
										maxLength={6}
										value={totpVerifyCode}
										onChange={(e) => {
											const value = e.target.value.replace(/[^0-9]/g, "");
											setTotpVerifyCode(value);
											setTotpError("");
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" && totpVerifyCode.length === 6) {
												handleVerifyTOTP();
											}
										}}
										placeholder="000000"
										className="w-full bg-card border border-gray-800 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
										autoFocus
									/>
									{totpError && (
										<p className="text-[10px] text-rose-500 font-bold pl-1">
											{totpError}
										</p>
									)}
								</div>

								{/* Info */}
								<div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
									<p className="text-xs text-gray-400">
										Open your authenticator app and enter the current 6-digit
										code for ZenFinance.
									</p>
								</div>

								{/* Actions */}
								<div className="flex flex-col gap-2 pt-2">
									<button
										onClick={handleVerifyTOTP}
										disabled={totpVerifyCode.length !== 6}
										className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Verify & Enable 2FA
									</button>
									<button
										onClick={() => setTotpStep("scan")}
										className="w-full bg-surface border border-gray-800 text-gray-400 font-bold py-3 rounded-xl active:scale-[0.98] transition-all text-sm"
									>
										Back to QR Code
									</button>
									<button
										onClick={() => {
											setShowTOTPSetup(false);
											setTotpSecret("");
											setTotpQRCode("");
											setTotpVerifyCode("");
											setTotpError("");
											setTotpStep("scan");
										}}
										className="w-full text-gray-500 font-bold py-2 rounded-xl active:scale-[0.98] transition-all text-sm"
									>
										Cancel
									</button>
								</div>
							</div>
						)}
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
							{(profile.biometricCredIds?.length ||
								profile.biometricCredId) && (
								<div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-2">
									<p className="text-emerald-400 text-xs font-bold flex items-center gap-2">
										<FingerPrintIcon className="w-4 h-4" />
										Passkeys are active
									</p>
									<p className="text-[10px] text-gray-400 mt-1">
										You can create a new passkey specifically for this device if
										needed, or verify your existing one.
									</p>
								</div>
							)}

							<button
								onClick={async () => {
									const credId = await SecurityService.registerBiometrics(
										profile.name,
										profile.biometricCredIds,
									);
									if (credId) {
										const currentHashed =
											sessionStorage.getItem("vault_password_session") ||
											localStorage.getItem("vault_password_session");
										if (currentHashed) {
											localStorage.setItem(
												"vault_password_remembered",
												currentHashed,
											);
										}
										onUpdate({
											biometricCredIds: Array.from(
												new Set([...(profile.biometricCredIds || []), credId]),
											),
										});
										showToast("New Passkey registered!", "success");
										setShowBiometricManagement(false);
									} else {
										showToast(
											"Registration failed. Passkeys are domain-specific.",
											"alert",
										);
									}
								}}
								className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
							>
								<FingerPrintIcon className="w-5 h-5" />
								Add New Passkey
							</button>

							{(profile.biometricCredIds?.length ||
								profile.biometricCredId) && (
								<>
									<button
										onClick={async () => {
											const credId =
												profile.biometricCredIds?.[0] ||
												profile.biometricCredId;
											if (!credId) {
												showToast("No passkey found", "alert");
												return;
											}
											const success =
												await SecurityService.verifyWithBiometrics(credId);
											if (success) {
												showToast("Passkey verified successfully!", "success");
											} else {
												showToast("Verification failed", "alert");
											}
										}}
										className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all"
									>
										Test Existing Passkey
									</button>
									<button
										onClick={() => {
											setConfirmationModal({
												isOpen: true,
												title: "Unlink Passkeys",
												description:
													"Unlink all security keys? You will need your vault password to unlock next time.",
												confirmLabel: "Unlink All",
												isDestructive: true,
												onConfirm: () => {
													localStorage.removeItem("biometric_cred_id");
													localStorage.removeItem("biometric_cred_ids");
													localStorage.removeItem("vault_password_remembered");
													onUpdate({
														biometricCredIds: [],
													});
													showToast("Security links removed", "info");
													setShowBiometricManagement(false);
												},
											});
										}}
										className="w-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black py-4 rounded-xl active:scale-[0.98] transition-all"
									>
										Unlink All Passkeys
									</button>
								</>
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
							icon={ShieldCheckIcon}
							label="Two-Factor Authentication"
							description={
								profile.totpSecret
									? "2FA is enabled for vault encryption"
									: "Setup required for vault encryption"
							}
							color={
								profile.totpSecret ? "text-emerald-400" : "text-yellow-400"
							}
							onClick={() => {
								if (profile.totpSecret) {
									handleDisableTOTP();
								} else {
									handleSetupTOTP();
								}
							}}
							action={
								profile.totpSecret ? (
									<div className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400">
										Enabled
									</div>
								) : (
									<div className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-yellow-500/20 text-yellow-400">
										Setup
									</div>
								)
							}
						/>
						<SettingItem
							icon={LockClosedIcon}
							label="Secure Vault"
							description={
								isVaultCreated
									? isVaultUnlocked
										? "Vault is unlocked. Your data is decrypted."
										: isVaultEnabled
											? "Vault is locked. Data is encrypted."
											: "Vault is disabled. Data is stored without encryption."
									: "Enable a Secure Vault to protect sensitive details."
							}
							color={
								isVaultEnabled
									? isVaultUnlocked
										? "text-emerald-400"
										: "text-rose-400"
									: "text-gray-400"
							}
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
								profile.biometricCredIds?.length || profile.biometricCredId
									? "Passkey Available"
									: "Register Passkey"
							}
							description={
								profile.biometricCredIds?.length || profile.biometricCredId
									? "Stored in cloud (sync available)"
									: "Use TouchID/FaceID for secure reveal"
							}
							color={
								profile.biometricCredIds?.length || profile.biometricCredId
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

						{/* Google Sheets Link Status */}
						<SettingItem
							icon={CloudArrowUpIcon}
							label="Google Sheets Connection"
							description={
								profile.offlineMode
									? "Not linked to Google Sheets"
									: `Linked to ${profile.email || "Google Account"}`
							}
							color={profile.offlineMode ? "text-gray-400" : "text-sky-400"}
							onClick={
								profile.offlineMode
									? onLogin
									: () => {
											setConfirmationModal({
												isOpen: true,
												title: "Disconnect Cloud",
												description:
													"Disconnect from Google Sheets? Your data will remain on this device but won't sync to the cloud until re-linked.",
												confirmLabel: "Disconnect",
												isDestructive: true,
												onConfirm: () => {
													if (onUnlinkCloud) onUnlinkCloud();
												},
											});
										}
							}
							action={
								<div
									className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
										profile.offlineMode
											? "bg-gray-800 text-gray-400"
											: "bg-sky-500/20 text-sky-400 border border-sky-500/30"
									}`}
								>
									{profile.offlineMode ? "Unlinked" : "Linked"}
								</div>
							}
						/>

						{!profile.offlineMode && onSync && (
							<SettingItem
								icon={ArrowPathIcon}
								label="Sync Now"
								description={
									isSyncing
										? "Synchronizing your data..."
										: "Force sync with Google Sheets"
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
						{!profile.offlineMode && onSelectSheet && (
							<GoogleDrivePicker
								onPicked={(fileId) => onSelectSheet(fileId)}
								onCancel={() => console.log("Picker canceled")}
							>
								<SettingItem
									icon={DocumentArrowDownIcon}
									label="Re-link Google Sheet"
									description="Manually select your data file if it's missing"
									color="text-amber-400"
								/>
							</GoogleDrivePicker>
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
							onClick={() => setShowExportModal(true)}
							color="text-gray-400"
						/>
						<SettingItem
							icon={CalculatorIcon}
							label="Recalculate Balances"
							description="Fix account balance desyncs from history"
							onClick={recalculateBalances}
							color="text-emerald-400"
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

			<Modal
				isOpen={confirmationModal.isOpen}
				onClose={() =>
					setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
				}
				title={confirmationModal.title}
				description={confirmationModal.description}
				icon={
					confirmationModal.isDestructive
						? ArrowRightOnRectangleIcon
						: undefined
				}
				iconColor={
					confirmationModal.isDestructive ? "text-rose-400" : "text-primary"
				}
				iconBgColor={
					confirmationModal.isDestructive ? "bg-rose-500/10" : "bg-primary/10"
				}
			>
				<div className="grid grid-cols-2 gap-3">
					<button
						onClick={() =>
							setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
						}
						className="py-3 px-4 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={() => {
							confirmationModal.onConfirm();
							setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
						}}
						className={`py-3 px-4 rounded-xl font-bold text-sm transition-colors shadow-lg ${
							confirmationModal.isDestructive
								? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white"
								: "bg-primary hover:bg-primary-600 shadow-primary/20 text-white"
						}`}
					>
						{confirmationModal.confirmLabel}
					</button>
				</div>
			</Modal>
		</div>
	);
};

export default Profile;
