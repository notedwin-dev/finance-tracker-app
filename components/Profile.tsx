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
	EyeSlashIcon,
	CalculatorIcon,
} from "@heroicons/react/24/outline";
import { useSyncStore } from "../src/stores/sync.store";
import { useFinanceStore } from "../src/stores/finance.store";
import { runVaultSchemaMigration } from "../src/lib/application/commands/migration";
import { needsV1Migration } from "../src/lib/domain/migration";
import { useMask } from "../helpers/useMask";
import { useMaskStore } from "../src/stores/mask.store";
import Modal from "./Modal";
import ConfirmationModal, { ConfirmationModalState } from "./ConfirmationModal";
import DatePicker from "./DatePicker";
import { GoogleDrivePicker } from "./GoogleDrivePicker";
import { logger } from "../src/lib/infrastructure/logger";

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
	onRecalculateBalances?: () => Promise<void>;
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
	onUnlinkCloud,
	onResetSync,
	onSelectSheet,
	onRecalculateBalances,
	isSyncing = false,
}) => {
	const { maskText } = useMask();
	const maskMode = useMaskStore((s) => s.maskMode);
	const accounts = useFinanceStore((s) => s.accounts);
	const showV1Migration = needsV1Migration(profile, accounts);

	const handleRecalculateBalances = async () => {
		if (onRecalculateBalances) {
			await onRecalculateBalances();
		}
	};
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState(profile.name);
	const [showExportModal, setShowExportModal] = useState(false);
	const [exportStartDate, setExportStartDate] = useState("");
	const [exportEndDate, setExportEndDate] = useState("");
	const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
		isOpen: false,
		title: "",
		description: "",
		onConfirm: () => {},
		confirmLabel: "Confirm",
	});

	const handleSave = () => {
		onUpdate({ name });
		setIsEditing(false);
	};

	const requestConfirmation = (opts: {
		title: string;
		description: string;
		confirmLabel: string;
		isDestructive?: boolean;
		icon?: any;
		onConfirm: () => void;
	}) => {
		setConfirmationModal({
			isOpen: true,
			title: opts.title,
			description: opts.description,
			confirmLabel: opts.confirmLabel,
			isDestructive: opts.isDestructive,
			icon: opts.icon,
			onConfirm: opts.onConfirm,
		});
	};

	const runMigrationAndNotify = () => {
		runVaultSchemaMigration()
			.then(() =>
				useSyncStore.getState().showToast("Migration complete", "success"),
			)
			.catch((e) => {
				logger.error("Migration error:", e);
				useSyncStore.getState().showToast("Migration failed. Check console.", "alert");
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
							label="Mask Mode"
							description="Mask balances and text throughout the app"
							color="text-indigo-400"
							action={
								<button
									onClick={() => {
										const next = !maskMode;
										useMaskStore.getState().setMaskMode(next);
										onUpdate({ maskMode: next });
									}}
									className={`w-11 h-6 rounded-full transition-colors relative ${
										maskMode ? "bg-primary" : "bg-gray-800"
									}`}
								>
									<div
										className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
											maskMode ? "left-6" : "left-1"
										}`}
									/>
								</button>
							}
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
											requestConfirmation({
												title: "Disconnect Cloud",
												description:
													"Disconnect from Google Sheets? Your data will remain on this device but won't sync to the cloud until re-linked.",
												confirmLabel: "Disconnect",
												isDestructive: true,
												icon: ArrowRightOnRectangleIcon,
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
								onCancel={() => logger.log("Picker canceled")}
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
					{onRecalculateBalances && (
						<SettingItem
							icon={CalculatorIcon}
							label="Recalculate Balances"
							description="Fix account balance desyncs from history"
							onClick={handleRecalculateBalances}
							color="text-emerald-400"
						/>
					)}
						{showV1Migration && (
							<SettingItem
								icon={ArrowPathIcon}
								label="Migrate v1 data"
								description="One-time v1 → v2 cleanup. Strips legacy vault fields and syncs to cloud."
								color="text-amber-400"
								onClick={() => {
									requestConfirmation({
										title: "Run v1 → v2 Migration",
										description:
											"This will strip legacy vault fields from your local data and push the cleaned data to Google Sheets. Run on the device with the most complete data, while online. This cannot be undone.",
										confirmLabel: "Run Migration",
										onConfirm: runMigrationAndNotify,
									});
								}}
							/>
						)}

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
								Your key is stored locally on this device and synced to your cloud backup.
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

			<ConfirmationModal
				state={confirmationModal}
				onClose={() =>
					setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
				}
			/>
		</div>
	);
};

export default Profile;
