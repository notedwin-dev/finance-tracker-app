import React from "react";
import { SparklesIcon, CloudArrowUpIcon, KeyIcon } from "@heroicons/react/24/outline";
import type { UserProfile } from "../../types";
import { SectionHeader, SettingItem } from "./setting-row";

type Props = {
	profile: UserProfile;
	onUpdate: (updates: Partial<UserProfile>) => void;
};

const ToggleSwitch: React.FC<{ on: boolean; onToggle: () => void }> = ({
	on,
	onToggle,
}) => (
	<button
		onClick={onToggle}
		className={`w-11 h-6 rounded-full transition-colors relative ${
			on ? "bg-primary" : "bg-gray-800"
		}`}
	>
		<div
			className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
				on ? "left-6" : "left-1"
			}`}
		/>
	</button>
);

export const AiAssistantSection: React.FC<Props> = ({ profile, onUpdate }) => (
	<>
		<SectionHeader title="AI Assistant" />
		<SettingItem
			icon={SparklesIcon}
			label="Show Assistant"
			description="Enable floating AI toggle"
			color="text-fuchsia-400"
			action={
				<ToggleSwitch
					on={!!profile.showAIAssistant}
					onToggle={() => onUpdate({ showAIAssistant: !profile.showAIAssistant })}
				/>
			}
		/>
		<SettingItem
			icon={CloudArrowUpIcon}
			label="Sync Chats to Cloud"
			description="Backup conversations to Google Sheets"
			color="text-indigo-400"
			action={
				<ToggleSwitch
					on={!!profile.syncChatToSheets}
					onToggle={() => onUpdate({ syncChatToSheets: !profile.syncChatToSheets })}
				/>
			}
		/>
		<div className="p-4 space-y-3">
			<div className="flex items-center gap-3 mb-2">
				<div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
					<KeyIcon className="w-5 h-5" />
				</div>
				<div>
					<p className="text-sm font-semibold text-white">Gemini API Key</p>
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
	</>
);
