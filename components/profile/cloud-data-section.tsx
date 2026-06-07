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

type ActionProps = {
	icon: any;
	label: string;
	description: string;
	color: string;
	onClick?: () => void;
	action?: React.ReactNode;
};

const CloudActionItem = (props: ActionProps) => <SettingItem {...props} />;

const LinkBadge = ({ offlineMode }: { offlineMode: boolean }) => (
	<div
		className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
			offlineMode
				? "bg-gray-800 text-gray-400"
				: "bg-sky-500/20 text-sky-400 border border-sky-500/30"
		}`}
	>
		{offlineMode ? "Unlinked" : "Linked"}
	</div>
);

const getConnectionDescription = (offlineMode: boolean, email?: string): string =>
	offlineMode ? "Not linked to Google Sheets" : `Linked to ${email || "Google Account"}`;

const getConnectionColor = (offlineMode: boolean): string =>
	offlineMode ? "text-gray-400" : "text-sky-400";

const getSyncDescription = (isSyncing: boolean): string =>
	isSyncing ? "Synchronizing your data..." : "Force sync with Google Sheets";

const getConnectionOnClick = (
	offlineMode: boolean,
	onLogin: () => void,
	requestConfirmation: ConfirmationRequester,
	onUnlinkCloud: (() => void) | undefined,
): (() => void) | undefined =>
	offlineMode
		? onLogin
		: () => requestUnlinkConfirmation(requestConfirmation, () => onUnlinkCloud?.());

const requestUnlinkConfirmation = (
	requestConfirmation: ConfirmationRequester,
	onUnlink: () => void,
) => {
	requestConfirmation({
		title: "Disconnect Cloud",
		description:
			"Disconnect from Google Sheets? Your data will remain on this device but won't sync to the cloud until re-linked.",
		confirmLabel: "Disconnect",
		isDestructive: true,
		icon: ArrowRightOnRectangleIcon,
		onConfirm: onUnlink,
	});
};

const requestV1MigrationConfirmation = (
	requestConfirmation: ConfirmationRequester,
) => {
	requestConfirmation({
		title: "Run v1 → v2 Migration",
		description:
			"This will strip legacy vault fields from your local data and push the cleaned data to Google Sheets. Run on the device with the most complete data, while online. This cannot be undone.",
		confirmLabel: "Run Migration",
		onConfirm: runProfileMigration,
	});
};

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
	const offlineMode = profile.offlineMode;

	return (
		<>
			<SectionHeader title="Cloud & Data" />

			<CloudActionItem
				icon={CloudArrowUpIcon}
				label="Google Sheets Connection"
				description={getConnectionDescription(offlineMode, profile.email)}
				color={getConnectionColor(offlineMode)}
				onClick={getConnectionOnClick(offlineMode, onLogin, requestConfirmation, onUnlinkCloud)}
				action={<LinkBadge offlineMode={offlineMode} />}
			/>

			{!offlineMode && onSync && (
				<CloudActionItem
					icon={ArrowPathIcon}
					label="Sync Now"
					description={getSyncDescription(isSyncing)}
					onClick={onSync}
					color="text-sky-400"
					action={
						isSyncing ? (
							<ArrowPathIcon className="w-4 h-4 text-sky-400 animate-spin" />
						) : null
					}
				/>
			)}
			{!offlineMode && onSelectSheet && (
				<GoogleDrivePicker
					onPicked={(fileId) => onSelectSheet(fileId)}
					onCancel={() => logger.log("Picker canceled")}
				>
					<CloudActionItem
						icon={DocumentArrowDownIcon}
						label="Re-link Google Sheet"
						description="Manually select your data file if it's missing"
						color="text-amber-400"
					/>
				</GoogleDrivePicker>
			)}
			{onResetSync && (
				<CloudActionItem
					icon={ArrowPathIcon}
					label="Force Cloud Restore"
					description="Clear cache and re-download data"
					onClick={onResetSync}
					color="text-amber-400"
				/>
			)}
			{onMigrate && (
				<CloudActionItem
					icon={InboxArrowDownIcon}
					label="Import Data"
					description="Recover data from browser storage"
					onClick={onMigrate}
					color="text-purple-400"
				/>
			)}
			<CloudActionItem
				icon={DocumentArrowDownIcon}
				label="Export Backup"
				description="Download all data as JSON"
				onClick={onOpenExport}
				color="text-gray-400"
			/>
			{onRecalculateBalances && (
				<CloudActionItem
					icon={CalculatorIcon}
					label="Recalculate Balances"
					description="Fix account balance desyncs from history"
					onClick={onRecalculateBalances}
					color="text-emerald-400"
				/>
			)}
			{showV1Migration && (
				<CloudActionItem
					icon={ArrowPathIcon}
					label="Migrate v1 data"
					description="One-time v1 → v2 cleanup. Strips legacy vault fields and syncs to cloud."
					color="text-amber-400"
					onClick={() => requestV1MigrationConfirmation(requestConfirmation)}
				/>
			)}
		</>
	);
};
