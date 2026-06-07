import React from "react";
import { Account } from "../../types";
import DatePicker from "../DatePicker";
import { applyAmountFormat } from "../../helpers/amount-calculator";
import { XMarkIcon } from "@heroicons/react/24/solid";

type Props = {
	isOpen: boolean;
	editingId: string | null;
	accounts: Account[];
	name: string;
	target: string;
	current: string;
	deadline: string;
	category: string;
	linkedAccountId: string;
	isSubmitting: boolean;
	onNameChange: (v: string) => void;
	onTargetChange: (v: string) => void;
	onCurrentChange: (v: string) => void;
	onDeadlineChange: (v: string) => void;
	onCategoryChange: (v: string) => void;
	onLinkedAccountIdChange: (v: string) => void;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
};

const CATEGORIES: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "SHORT_TERM", label: "Short Term" },
	{ value: "LONG_TERM", label: "Long Term" },
];

export const GoalFormModal: React.FC<Props> = ({
	isOpen,
	editingId,
	accounts,
	name,
	target,
	current,
	deadline,
	category,
	linkedAccountId,
	isSubmitting,
	onNameChange,
	onTargetChange,
	onCurrentChange,
	onDeadlineChange,
	onCategoryChange,
	onLinkedAccountIdChange,
	onClose,
	onSubmit,
}) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
			<div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
				<div className="p-4 sm:p-5 border-b border-gray-700 bg-surface shrink-0 flex justify-between items-center">
					<div>
						<h3 className="text-base sm:text-lg font-bold text-white">
							{editingId ? "Edit Savings Goal" : "Create Savings Goal"}
						</h3>
						<p className="text-[10px] text-gray-500 font-medium">
							Track progress towards a target
						</p>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-white p-1"
					>
						<XMarkIcon className="w-6 h-6" />
					</button>
				</div>

				<form
					onSubmit={onSubmit}
					className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-20 sm:pb-6"
				>
					<div>
						<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
							Goal Name
						</label>
						<input
							type="text"
							required
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
							placeholder="e.g. New Car"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
								Target Amount
							</label>
							<input
								type="text"
								inputMode="decimal"
								required
								value={target}
								onChange={(e) => applyAmountFormat(e.target.value, target, onTargetChange)}
								className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
								placeholder="0.00"
							/>
						</div>
						<div>
							<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
								Current (Manual)
							</label>
							<input
								type="text"
								inputMode="decimal"
								value={current}
								disabled={!!linkedAccountId}
								onChange={(e) => applyAmountFormat(e.target.value, current, onCurrentChange)}
								className={`w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none ${linkedAccountId ? "opacity-30 cursor-not-allowed" : ""}`}
								placeholder="0.00"
							/>
						</div>
					</div>

					<div>
						<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
							Linked Account (Auto-sync)
						</label>
						<select
							value={linkedAccountId}
							onChange={(e) => {
								onLinkedAccountIdChange(e.target.value);
								if (e.target.value) onCurrentChange("");
							}}
							className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none appearance-none font-medium"
						>
							<option value="">No Link (Manual Tracking)</option>
							{accounts.map((acc) => (
								<option key={acc.id} value={acc.id}>
									{acc.name} ({acc.currency} {acc.balance.toLocaleString()})
								</option>
							))}
						</select>
						{linkedAccountId && (
							<p className="text-[10px] text-primary mt-2 font-medium">
								Goal progress will track this account's live balance.
							</p>
						)}
					</div>

					<div>
						<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
							Deadline (Optional)
						</label>
						<DatePicker value={deadline} onChange={onDeadlineChange} />
					</div>

					<div>
						<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
							Goal Type
						</label>
						<select
							required
							value={category}
							onChange={(e) => onCategoryChange(e.target.value)}
							className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none appearance-none font-medium"
						>
							{CATEGORIES.map((c) => (
								<option key={c.value} value={c.value}>
									{c.label}
								</option>
							))}
						</select>
					</div>

					<div className="flex gap-3 pt-4 shrink-0">
						<button
							type="submit"
							disabled={isSubmitting}
							className={`flex-1 text-white font-bold py-3 sm:py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] text-sm ${
								isSubmitting
									? "bg-gray-600 cursor-not-allowed"
									: "bg-primary hover:bg-primary-hover"
							}`}
						>
							{isSubmitting
								? "Saving..."
								: editingId
									? "Update Goal"
									: "Create Goal"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
