import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
	HomeIcon,
	ClockIcon,
	ChartBarIcon,
	UserIcon,
	PlusIcon,
} from "@heroicons/react/24/outline";
import {
	HomeIcon as HomeIconSolid,
	ClockIcon as ClockIconSolid,
	ChartBarIcon as ChartBarIconSolid,
	UserIcon as UserIconSolid,
} from "@heroicons/react/24/solid";

const MobileNavLink: React.FC<{
	to: string;
	icon: any;
	iconSolid: any;
	label: string;
	active: boolean;
}> = ({ to, icon: Icon, iconSolid: IconSolid, label, active }) => (
	<Link
		to={to}
		className={`flex flex-col items-center justify-center pt-1 transition-all ${
			active ? "text-indigo-400 scale-110" : "text-gray-600 hover:text-gray-400"
		}`}
	>
		<div className={`p-2 rounded-xl transition-all ${active ? "bg-indigo-500/10" : ""}`}>
			{active ? <IconSolid className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
		</div>
		<span
			className={`text-[8px] font-black mt-0.5 tracking-widest ${
				active ? "opacity-100" : "opacity-40"
			}`}
		>
			{label}
		</span>
	</Link>
);

type MobileBottomNavProps = {
	onAdd: () => void;
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onAdd }) => {
	const location = useLocation();
	const isActive = (path: string) => location.pathname === path;

	return (
		<div className="lg:hidden fixed bottom-6 left-0 w-full px-6 z-40">
			<div className="relative bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
				<div className="absolute -top-8 left-1/2 -translate-x-1/2">
					<button
						onClick={onAdd}
						className="w-16 h-16 bg-indigo-600 rounded-full shadow-[0_8px_20px_rgba(79,70,229,0.4)] flex items-center justify-center text-white border-[6px] border-[#0A0A0A] transform transition-transform active:scale-90"
					>
						<PlusIcon className="w-8 h-8" />
					</button>
				</div>

				<nav className="flex justify-between items-center h-16">
					<div className="flex-1 flex justify-around items-center">
						<MobileNavLink
							to="/app"
							icon={HomeIcon}
							iconSolid={HomeIconSolid}
							label="HOME"
							active={isActive("/app")}
						/>
						<MobileNavLink
							to="/app/history"
							icon={ClockIcon}
							iconSolid={ClockIconSolid}
							label="HISTORY"
							active={isActive("/app/history")}
						/>
					</div>

					<div className="w-16"></div>

					<div className="flex-1 flex justify-around items-center">
						<MobileNavLink
							to="/app/goals"
							icon={ChartBarIcon}
							iconSolid={ChartBarIconSolid}
							label="GOALS"
							active={isActive("/app/goals")}
						/>
						<MobileNavLink
							to="/app/profile"
							icon={UserIcon}
							iconSolid={UserIconSolid}
							label="PROFILE"
							active={isActive("/app/profile")}
						/>
					</div>
				</nav>
			</div>
		</div>
	);
};
