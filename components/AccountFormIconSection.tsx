import React from "react";
import { Account } from "../types";

type Props = {
	iconType: Account["iconType"];
	iconValue: string;
	onIconTypeChange: (value: Account["iconType"]) => void;
	onIconValueChange: (value: string) => void;
};

export const AccountFormIconSection = ({
	iconType,
	iconValue,
	onIconTypeChange,
	onIconValueChange,
}: Props) => (
	<div className="grid grid-cols-2 gap-4">
		<div>
			<label className="block text-xs font-medium text-gray-500 mb-1">
				Icon Type
			</label>
			<select
				value={iconType}
				onChange={(e) => onIconTypeChange(e.target.value as Account["iconType"])}
				className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm"
			>
				<option value="EMOJI">Emoji</option>
				<option value="IMAGE">Image URL</option>
			</select>
		</div>
		<div>
			<label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
			<input
				type="text"
				value={iconValue}
				onChange={(e) => onIconValueChange(e.target.value)}
				className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-primary focus:outline-none"
				placeholder={iconType === "EMOJI" ? "e.g. 💰" : "https://..."}
			/>
		</div>
	</div>
);
