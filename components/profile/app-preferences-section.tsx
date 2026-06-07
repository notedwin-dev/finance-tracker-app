import React from "react";
import { EyeSlashIcon, TagIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { useMaskStore } from "../../src/stores/mask.store";
import type { UserProfile } from "../../types";
import { SectionHeader, SettingItem } from "./setting-row";

type Props = {
	profile: UserProfile;
	onUpdate: (updates: Partial<UserProfile>) => void;
	onManageCategories?: () => void;
	onManageSubscriptions?: () => void;
};

export const AppPreferencesSection: React.FC<Props> = ({
	profile,
	onUpdate,
	onManageCategories,
	onManageSubscriptions,
}) => {
	const maskMode = useMaskStore((s) => s.maskMode);

	return (
		<>
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
		</>
	);
};
