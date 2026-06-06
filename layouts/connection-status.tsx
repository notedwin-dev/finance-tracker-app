import { useEffect, useState } from "react";
import { LinkSlashIcon } from "@heroicons/react/24/outline";

export const useOnlineStatus = (): boolean => {
	const [isOnline, setIsOnline] = useState(navigator.onLine);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return isOnline;
};

interface OfflineBannerProps {
	variant: "block" | "chip";
	isOnline: boolean;
	offlineMode: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
	variant,
	isOnline,
	offlineMode,
}) => {
	if (isOnline && !offlineMode) return null;
	const isOffline = !isOnline;
	const label = isOffline ? "No Connection" : "Local Mode";
	const subtext = isOffline
		? "You are currently disconnected from the internet. Changes will sync when online."
		: "Data is saved only on this device. Cloud sync is disabled.";

	if (variant === "chip") {
		if (isOffline) {
			return (
				<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-wider">
					<div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
					{label}
				</div>
			);
		}
		return (
			<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider">
				<LinkSlashIcon className="w-3.5 h-3.5" />
				Offline
			</div>
		);
	}

	if (isOffline) {
		return (
			<div className="mb-6 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
				<div className="flex items-center gap-2 text-rose-500 mb-1">
					<div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
					<span className="text-xs font-black uppercase tracking-widest">
						{label}
					</span>
				</div>
				<p className="text-[10px] text-gray-500 leading-relaxed font-medium">
					{subtext}
				</p>
			</div>
		);
	}

	return (
		<div className="mb-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
			<div className="flex items-center gap-2 text-amber-500 mb-1">
				<LinkSlashIcon className="w-4 h-4" />
				<span className="text-xs font-black uppercase tracking-widest">
					{label}
				</span>
			</div>
			<p className="text-[10px] text-gray-500 leading-relaxed font-medium">
				{subtext}
			</p>
		</div>
	);
};
