import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
	HomeIcon,
	ClockIcon,
	ChartBarIcon,
	Squares2X2Icon,
	UserIcon,
} from "@heroicons/react/24/outline";
import { OfflineBanner } from "./connection-status";
import { MaskModeToggle } from "./mask-mode-toggle";

const zenLogo = "/images/ZenFinance.svg";

const SidebarLink: React.FC<{
	to: string;
	icon: any;
	label: string;
	active: boolean;
}> = ({ to, icon: Icon, label, active }) => (
	<Link
		to={to}
		className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all font-medium ${
			active
				? "bg-primary text-white shadow-lg shadow-indigo-900/30"
				: "text-gray-400 hover:text-white hover:bg-white/5"
		}`}
	>
		<Icon className="w-5 h-5" />
		{label}
	</Link>
);

type DesktopSidebarProps = {
	isOnline: boolean;
	offlineMode: boolean;
	maskMode: boolean;
	onToggleMask: () => void;
};

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
	isOnline,
	offlineMode,
	maskMode,
	onToggleMask,
}) => {
	const location = useLocation();
	const isActive = (path: string) => location.pathname === path;

	return (
		<aside className="hidden lg:flex flex-col w-64 h-screen bg-surface border-r border-gray-800 p-6 fixed left-0 top-0 z-40">
			<div className="flex items-center gap-3 mb-10">
				<img src={zenLogo} alt="ZenFinance Logo" className="w-8 h-8 object-contain" />
				<h1 className="text-xl font-bold tracking-tight text-white">ZenFinance</h1>
			</div>

			<OfflineBanner variant="block" isOnline={isOnline} offlineMode={offlineMode} />

			<nav className="flex-1 space-y-2">
				<SidebarLink to="/app" icon={HomeIcon} label="Dashboard" active={isActive("/app")} />
				<SidebarLink
					to="/app/history"
					icon={ClockIcon}
					label="Transactions"
					active={isActive("/app/history")}
				/>
				<SidebarLink
					to="/app/goals"
					icon={ChartBarIcon}
					label="Goals & Pots"
					active={isActive("/app/goals")}
				/>
				<SidebarLink
					to="/app/assets"
					icon={Squares2X2Icon}
					label="My Assets"
					active={isActive("/app/assets")}
				/>
				<SidebarLink
					to="/app/profile"
					icon={UserIcon}
					label="Profile"
					active={isActive("/app/profile")}
				/>
			</nav>

			<div className="mt-auto space-y-3 pt-6 border-t border-gray-800" aria-label="Mask mode toggle">
				<OfflineBanner variant="chip" isOnline={isOnline} offlineMode={offlineMode} />
				<MaskModeToggle
					maskMode={maskMode}
					onToggle={onToggleMask}
					variant="sidebar"
				/>
			</div>
		</aside>
	);
};
