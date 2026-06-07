import React from "react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { SectionHeader } from "./setting-row";

type Props = {
	onLogout: () => void;
};

export const DangerZoneSection: React.FC<Props> = ({ onLogout }) => (
	<>
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
	</>
);
