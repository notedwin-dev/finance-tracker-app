import React from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

type SettingItemProps = {
	icon: any;
	label: string;
	description?: string;
	onClick?: (props?: any) => void;
	action?: React.ReactNode;
	color?: string;
};

export const SettingItem: React.FC<SettingItemProps> = ({
	icon: Icon,
	label,
	description,
	onClick,
	action,
	color = "text-gray-400",
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

export const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
	<h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-4 pt-6 pb-2">
		{title}
	</h3>
);
