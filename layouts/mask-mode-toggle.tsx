import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface MaskModeToggleProps {
	maskMode: boolean;
	onToggle: () => void;
	variant: "sidebar" | "header";
}

export const MaskModeToggle: React.FC<MaskModeToggleProps> = ({
	maskMode,
	onToggle,
	variant,
}) => {
	if (variant === "header") {
		return (
			<button
				type="button"
				onClick={onToggle}
				aria-label="Toggle mask mode"
				aria-pressed={maskMode}
				className={`p-2 rounded-xl transition-all ${
					maskMode
						? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]"
						: "bg-surface border border-gray-800 text-gray-400"
				}`}
			>
				{maskMode ? (
					<EyeSlashIcon className="w-5 h-5" />
				) : (
					<EyeIcon className="w-5 h-5" />
				)}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={maskMode}
			className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800/50 transition-all group"
		>
			<div className="flex items-center gap-3">
				<div className="text-gray-400 group-hover:text-indigo-400 transition-colors">
					{maskMode ? (
						<EyeSlashIcon className="w-5 h-5" />
					) : (
						<EyeIcon className="w-5 h-5" />
					)}
				</div>
				<span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">
					Mask Mode
				</span>
			</div>
			<div
				className={`w-8 h-4 rounded-full relative transition-colors ${
					maskMode ? "bg-indigo-500" : "bg-gray-700"
				}`}
			>
				<div
					className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
						maskMode ? "right-1" : "left-1"
					}`}
				/>
			</div>
		</button>
	);
};
