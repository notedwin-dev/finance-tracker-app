import React from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

type Props = {
	isInline: boolean;
	title: string;
	onOpenSidebar: () => void;
	onClose: () => void;
};

export const ChatHeader: React.FC<Props> = ({
	isInline,
	title,
	onOpenSidebar,
	onClose,
}) => (
	<header
		className={`${
			isInline ? "h-12" : "h-16"
		} border-b border-gray-800 flex items-center justify-between px-4 sm:px-6 bg-background/50 backdrop-blur-xl shrink-0`}
	>
		<div className="flex items-center gap-4">
			<button
				onClick={onOpenSidebar}
				className={`${isInline ? "" : "lg:hidden"} p-2 text-gray-400`}
			>
				<Bars3Icon className="w-6 h-6" />
			</button>
			<div>
				<h2 className="text-sm font-bold text-white truncate max-w-37.5 sm:max-w-xs">
					{title || "AI Assistant"}
				</h2>
				{!isInline && (
					<div className="flex items-center gap-1.5">
						<div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
						<span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
							Gemini 3.1 Flash Lite
						</span>
					</div>
				)}
			</div>
		</div>
		{!isInline && (
			<button
				onClick={onClose}
				className="p-2 text-gray-500 hover:text-white transition-colors"
			>
				<XMarkIcon className="w-6 h-6" />
			</button>
		)}
	</header>
);
