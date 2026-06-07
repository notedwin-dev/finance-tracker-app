import React from "react";
import { XMarkIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Account } from "../types";

type Props = {
	editingId: string | null;
	accounts: Account[];
	onClose: () => void;
	onAssetSelect: (id: string) => void;
};

export const AccountFormHeader = ({
	editingId,
	accounts,
	onClose,
	onAssetSelect,
}: Props) => (
	<div className="p-4 sm:p-5 border-b border-gray-800 space-y-3 shrink-0">
		<div className="flex justify-between items-center">
			<h2 className="text-lg sm:text-xl font-bold text-white">Manage Asset</h2>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close"
				className="text-gray-400 hover:text-white p-1"
			>
				<XMarkIcon className="w-6 h-6" />
			</button>
		</div>

		<div className="relative">
			<label className="block text-[10px] sm:text-xs font-bold text-primary mb-1 uppercase tracking-wide">
				Select Asset to Edit
			</label>
			<div className="relative">
				<select
					value={editingId || "NEW"}
					onChange={(e) => onAssetSelect(e.target.value)}
					className="w-full bg-surface border border-gray-700 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm appearance-none focus:border-primary focus:outline-none pr-10 font-medium"
				>
					<option value="NEW">✨ Create New Asset</option>
					{accounts.length > 0 && (
						<optgroup label="Existing Assets">
							{accounts.map((a) => (
								<option key={a.id} value={a.id}>
									{a.name} ({a.currency} {a.balance.toFixed(2)})
								</option>
							))}
						</optgroup>
					)}
				</select>
				<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
					<ChevronUpDownIcon className="w-4 h-4 sm:w-5 sm:h-5" />
				</div>
			</div>
		</div>
	</div>
);
