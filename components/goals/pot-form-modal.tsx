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
	accountId: string;
	target: string;
	current: string;
	resetDate: string;
	isSubmitting: boolean;
	onNameChange: (v: string) => void;
	onAccountIdChange: (v: string) => void;
	onTargetChange: (v: string) => void;
	onCurrentChange: (v: string) => void;
	onResetDateChange: (v: string) => void;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
};

const getAccountName = (accounts: Account[], id: string) =>
	accounts.find((a) => a.id === id)?.name || "Unknown Account";

export const PotFormModal: React.FC<Props> = ({
	isOpen,
	editingId,
	accounts,
	name,
	accountId,
	target,
	current,
	resetDate,
	isSubmitting,
	onNameChange,
	onAccountIdChange,
	onTargetChange,
	onCurrentChange,
	onResetDateChange,
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
							{editingId ? "Edit Spending Pot" : "Create Spending Pot"}
						</h3>
						<p className="text-[10px] text-gray-500 font-medium">
							Set a spending limit within an account
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
							Pot Name
						</label>
						<input
							type="text"
							required
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
							placeholder="e.g. Dream Holiday"
						/>
					</div>

					<div>
						<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
							Linked Account
						</label>
						<select
							required
							value={accountId}
							onChange={(e) => onAccountIdChange(e.target.value)}
							className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none appearance-none font-medium"
						>
							<option value="">Select Account</option>
							{accounts.map((acc) => (
								<option key={acc.id} value={acc.id}>
									{acc.name} ({acc.currency} {acc.balance.toLocaleString()})
								</option>
							))}
						</select>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
								Spending Limit
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
								Amount Used
							</label>
							<input
								type="text"
								inputMode="decimal"
								required
								value={current}
								onChange={(e) => applyAmountFormat(e.target.value, current, onCurrentChange)}
								className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
								placeholder="0.00"
							/>
						</div>
					</div>

					<div>
						<label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
							Reset Date (Optional)
						</label>
						<DatePicker value={resetDate} onChange={onResetDateChange} />
						<p className="text-[10px] text-gray-500 mt-1.5 font-medium">
							Only count transactions from this date onwards. Leave empty to
							include all transactions.
						</p>
					</div>

					{accountId && (
						<div className="bg-primary/5 border border-primary/20 rounded-xl p-3 sm:p-4">
							<p className="text-[10px] sm:text-xs text-primary/80 font-medium leading-relaxed">
								This pot sets a spending limit for funds within{" "}
								{getAccountName(accounts, accountId)}. Tracking your usage here
								helps you stay within budget.
							</p>
						</div>
					)}

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
									? "Update Pot"
									: "Create Pot"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
