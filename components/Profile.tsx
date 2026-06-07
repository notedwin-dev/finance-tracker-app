import React, { useState } from "react";
import { UserProfile, Account } from "../types";
import { useFinanceStore } from "../src/stores/finance.store";
import ConfirmationModal, { ConfirmationModalState } from "./ConfirmationModal";
import { ProfileHeader } from "./profile/profile-header";
import { AppPreferencesSection } from "./profile/app-preferences-section";
import { CloudDataSection } from "./profile/cloud-data-section";
import { AiAssistantSection } from "./profile/ai-assistant-section";
import { DangerZoneSection } from "./profile/danger-zone-section";
import { SignInPrompt } from "./profile/sign-in-prompt";
import { ExportModal } from "./profile/export-modal";

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
	const accounts = useFinanceStore((s) => s.accounts) as Account[];

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

	const runExport = () => {
		if (onExport) onExport(exportStartDate, exportEndDate);
	};

	return (
		<div className="flex flex-col h-full max-w-2xl mx-auto animate-fadeIn pb-20">
			<ExportModal
				isOpen={showExportModal}
				onClose={() => setShowExportModal(false)}
				startDate={exportStartDate}
				endDate={exportEndDate}
				onStartDateChange={setExportStartDate}
				onEndDateChange={setExportEndDate}
				onExport={runExport}
			/>

			{profile.isLoggedIn ? (
				<div className="w-full space-y-2">
					<ProfileHeader
						profile={profile}
						isEditing={isEditing}
						name={name}
						onStartEdit={() => {
							setName(profile.name);
							setIsEditing(true);
						}}
						onNameChange={setName}
						onSave={handleSave}
						onCancel={() => setIsEditing(false)}
					/>

					<div className="bg-surface sm:rounded-3xl border border-gray-800 divide-y divide-gray-800/50 overflow-hidden">
						<AppPreferencesSection
							profile={profile}
							onUpdate={onUpdate}
							onManageCategories={onManageCategories}
							onManageSubscriptions={onManageSubscriptions}
						/>

						<CloudDataSection
							profile={profile}
							accounts={accounts}
							isSyncing={isSyncing}
							onLogin={onLogin}
							onSync={onSync}
							onUnlinkCloud={onUnlinkCloud}
							onResetSync={onResetSync}
							onSelectSheet={onSelectSheet}
							onMigrate={onMigrate}
							onRecalculateBalances={onRecalculateBalances}
							onOpenExport={() => setShowExportModal(true)}
							requestConfirmation={requestConfirmation}
						/>

						<AiAssistantSection profile={profile} onUpdate={onUpdate} />

						<DangerZoneSection onLogout={onLogout} />
					</div>
				</div>
			) : (
				<SignInPrompt onLogin={onLogin} />
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
