import React from "react";
import { ASSET_PROVIDERS } from "../types";

type Props = {
	selectedProviderId: string | null;
	onSelect: (provider: (typeof ASSET_PROVIDERS)[0]) => void;
};

export const AccountFormAssetGrid = ({ selectedProviderId, onSelect }: Props) => (
	<div className="grid grid-cols-4 gap-3">
		{ASSET_PROVIDERS.map((p) => {
			const isSelected = selectedProviderId === p.id;
			return (
				<button
					key={p.id}
					type="button"
					onClick={() => onSelect(p)}
					className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 relative ${
						isSelected
							? "border-primary bg-primary/20 shadow-lg shadow-primary/10 scale-105 z-10"
							: "border-gray-800 bg-surface/50 hover:bg-gray-800 hover:border-gray-600"
					}`}
				>
					{isSelected && (
						<div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></div>
					)}
					<img
						src={p.icon}
						alt={p.name}
						className="w-10 h-10 object-contain bg-white rounded-full p-1 shadow-sm"
					/>
					<span
						className={`text-[10px] text-center font-medium leading-tight ${isSelected ? "text-white" : "text-gray-400"}`}
					>
						{p.name}
					</span>
				</button>
			);
		})}
	</div>
);
