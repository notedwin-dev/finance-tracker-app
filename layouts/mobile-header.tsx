import React from "react";
import { Link } from "react-router-dom";
import { UserIcon } from "@heroicons/react/24/outline";
import { OfflineBanner } from "./connection-status";
import { MaskModeToggle } from "./mask-mode-toggle";

const zenLogo = "/images/ZenFinance.svg";

type MobileHeaderProps = {
	photoUrl?: string;
	isOnline: boolean;
	offlineMode: boolean;
	maskMode: boolean;
	onToggleMask: () => void;
};

export const MobileHeader: React.FC<MobileHeaderProps> = ({
	photoUrl,
	isOnline,
	offlineMode,
	maskMode,
	onToggleMask,
}) => (
	<header className="lg:hidden flex justify-between items-center px-6 h-20 bg-background/90 backdrop-blur-md sticky top-0 z-60 border-b border-gray-800 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
		<div className="flex items-center gap-2">
			<img src={zenLogo} alt="ZenFinance Logo" className="w-7 h-7 object-contain" />
			<h1 className="text-xl font-black text-white tracking-tighter">
				Zen<span className="text-indigo-400 font-black">Finance</span>
			</h1>
		</div>
		<div className="flex items-center gap-4">
			<OfflineBanner variant="chip" isOnline={isOnline} offlineMode={offlineMode} />
			<MaskModeToggle maskMode={maskMode} onToggle={onToggleMask} variant="header" />
			<Link to="/app/profile" className="relative group">
				{photoUrl ? (
					<div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 overflow-hidden bg-surface shadow-lg group-active:scale-90 transition-transform">
						<img
							src={photoUrl}
							className="w-full h-full object-cover"
							alt="Avatar"
							referrerPolicy="no-referrer"
						/>
					</div>
				) : (
					<div className="w-10 h-10 rounded-full bg-surface border-2 border-gray-800 flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
						<UserIcon className="w-6 h-6 text-gray-400" />
					</div>
				)}
				<div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full"></div>
			</Link>
		</div>
	</header>
);
