import React from "react";
import {
	ArrowRightOnRectangleIcon,
	CloudArrowUpIcon,
	ArrowPathIcon,
	InboxArrowDownIcon,
	DocumentArrowDownIcon,
	CalculatorIcon,
} from "@heroicons/react/24/outline";
import type { UserProfile, Account } from "../../types";
import { GoogleDrivePicker } from "../GoogleDrivePicker";
import { logger } from "../../src/lib/infrastructure/logger";
import { needsV1Migration } from "../../src/lib/domain/migration";
import { SectionHeader, SettingItem } from "./setting-row";
import { runProfileMigration } from "./profile-migration";

type ConfirmationRequester = (opts: {
	title: string;
	description: string;
	confirmLabel: string;
	isDestructive?: boolean;
	icon?: any;
	onConfirm: () => void;
}) => void;

type Props = {
	profile: UserProfile;
	accounts: Account[];
	isSyncing: boolean;
	onLogin: () => void;
	onSync?: () => void;
	onUnlinkCloud?: () => void;
	onResetSync?: () => void;
	onSelectSheet?: (sheetId: string) => void;
	onMigrate?: () => void;
	onRecalculateBalances?: () => Promise<void>;
	onOpenExport: () => void;
	requestConfirmation: ConfirmationRequester;
};

export const CloudDataSection: React.FC<Props> = ({
	profile,
	accounts,
	isSyncing,
	onLogin,
	onSync,
	onUnlinkCloud,
	onResetSync,
	onSelectSheet,
	onMigrate,
	onRecalculateBalances,
	onOpenExport,
	requestConfirmation,
}) => {
	const showV1Migration = needsV1Migration(profile, accounts);

	return (
		<>
			<SectionHeader title="Cloud & Data" />

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
				onClick={onOpenExport}
				color="text-gray-400"
			/>
			{onRecalculateBalances && (
				<SettingItem
					icon={CalculatorIcon}
					label="Recalculate Balances"
					description="Fix account balance desyncs from history"
					onClick={onRecalculateBalances}
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
							onConfirm: runProfileMigration,
						});
					}}
				/>
			)}
		</>
	);
};
