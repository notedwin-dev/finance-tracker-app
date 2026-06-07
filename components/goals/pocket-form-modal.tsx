import React, { useState } from "react";
import { Account } from "../../types";
import DatePicker from "../DatePicker";
import { applyAmountFormat } from "../../helpers/amount-calculator";
import { XMarkIcon } from "@heroicons/react/24/solid";

type PocketType = "SAVING_POCKET" | "BONUS_POCKET";
type Tenure = 2 | 3;

type Props = {
	isOpen: boolean;
	editingId: string | null;
	accounts: Account[];
	name: string;
	accountId: string;
	current: string;
	currency: string;
	icon: string;
	color: string;
	resetDate: string;
	pocketType: PocketType;
	tenureMonths: Tenure;
	isSubmitting: boolean;
	onNameChange: (v: string) => void;
	onAccountIdChange: (v: string) => void;
	onCurrentChange: (v: string) => void;
	onCurrencyChange: (v: string) => void;
	onIconChange: (v: string) => void;
	onColorChange: (v: string) => void;
	onResetDateChange: (v: string) => void;
	onPocketTypeChange: (v: PocketType) => void;
	onTenureMonthsChange: (v: Tenure) => void;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
};

const POCKET_TYPES: readonly PocketType[] = ["SAVING_POCKET", "BONUS_POCKET"];
const TENURE_OPTIONS: readonly Tenure[] = [2, 3];
const COLORS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "indigo-500", label: "Indigo" },
	{ value: "rose-500", label: "Rose" },
	{ value: "emerald-500", label: "Emerald" },
	{ value: "amber-500", label: "Amber" },
	{ value: "sky-500", label: "Sky" },
	{ value: "purple-500", label: "Purple" },
];

export const PocketFormModal: React.FC<Props> = ({
	isOpen,
	editingId,
	accounts,
	name,
	accountId,
	current,
	currency,
	icon,
	color,
	resetDate,
	pocketType,
	tenureMonths,
	isSubmitting,
	onNameChange,
	onAccountIdChange,
	onCurrentChange,
	onCurrencyChange,
	onIconChange,
	onColorChange,
	onResetDateChange,
	onPocketTypeChange,
	onTenureMonthsChange,
	onClose,
	onSubmit,
}) => {
	if (!isOpen) return null;

	const isGXBank =
		accounts.find((a) => a.id === accountId)?.providerId === "GXBANK";

	return (
		<div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
			<div className="w-full max-w-md bg-surface rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-slideUp">
				<div className="p-6 border-b border-white/5 flex justify-between items-center">
					<h2 className="text-xl font-black text-white tracking-tight">
						{editingId ? "Edit Pocket" : "New Saving Pocket"}
					</h2>
					<button
						onClick={onClose}
						className="p-2 text-gray-500 hover:text-white transition-colors"
					>
						<XMarkIcon className="w-6 h-6" />
					</button>
				</div>

				<form onSubmit={onSubmit} className="p-6 space-y-4">
					<div className="space-y-2">
						<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
							Linked Bank Account (Optional)
						</label>
						<select
							value={accountId}
							onChange={(e) => onAccountIdChange(e.target.value)}
							className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none appearance-none"
						>
							<option value="">No Linked Account</option>
							{accounts.map((acc) => (
								<option key={acc.id} value={acc.id}>
									{acc.name}
								</option>
							))}
						</select>
					</div>

					{isGXBank && (
						<div className="animate-fadeIn space-y-4 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
							<div className="space-y-2">
								<label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
									GXBank Pocket Type
								</label>
								<div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
									{POCKET_TYPES.map((type) => (
										<button
											key={type}
											type="button"
											onClick={() => onPocketTypeChange(type)}
											className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${
												pocketType === type
													? "bg-indigo-500 text-white shadow-lg"
													: "text-gray-500 hover:text-white"
											}`}
										>
											{type.replace("_", " ")}
										</button>
									))}
								</div>
							</div>

							{pocketType === "BONUS_POCKET" && (
								<div className="space-y-2 animate-fadeIn">
									<label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
										Bonus Tenure (Months)
									</label>
									<div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
										{TENURE_OPTIONS.map((months) => (
											<button
												key={months}
												type="button"
												onClick={() => onTenureMonthsChange(months)}
												className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${
													tenureMonths === months
														? "bg-indigo-500 text-white shadow-lg"
														: "text-gray-500 hover:text-white"
												}`}
											>
												{months} MONTHS
											</button>
										))}
									</div>
									<p className="text-[9px] text-gray-500 italic px-1">
										Bonus Pockets get higher interest (5%) if held for the
										tenure.
									</p>
								</div>
							)}
						</div>
					)}

					<div className="space-y-2">
						<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
							Pocket Name
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							placeholder="Emergency Fund, Holiday, etc."
							className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-gray-600 focus:border-indigo-500/50 transition-all outline-none"
							required
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
								Currency
							</label>
							<select
								value={currency}
								onChange={(e) => onCurrencyChange(e.target.value)}
								className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none appearance-none"
							>
								<option value="MYR">MYR (RM)</option>
								<option value="USD">USD ($)</option>
							</select>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
								Current Balance
							</label>
							<input
								type="text"
								inputMode="decimal"
								value={current}
								onChange={(e) => applyAmountFormat(e.target.value, current, onCurrentChange)}
								placeholder="0.00"
								className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-gray-600 focus:border-indigo-500/50 transition-all outline-none"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
								Icon
							</label>
							<input
								type="text"
								value={icon}
								onChange={(e) => onIconChange(e.target.value)}
								placeholder="🚀"
								className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none text-center text-2xl"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
								Color (Tailwind)
							</label>
							<select
								value={color}
								onChange={(e) => onColorChange(e.target.value)}
								className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none"
							>
								{COLORS.map((c) => (
									<option key={c.value} value={c.value}>
										{c.label}
									</option>
								))}
							</select>
						</div>
					</div>

					<div className="space-y-2">
						<label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
							Reset Date (Optional)
						</label>
						<DatePicker value={resetDate} onChange={onResetDateChange} />
						<p className="text-[9px] text-gray-500 mt-1 italic px-1">
							Only count transactions from this date onwards. Leave empty to
							include all transactions.
						</p>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full bg-white text-black font-black py-4 rounded-2xl mt-4 hover:bg-indigo-400 hover:text-white transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
					>
						{isSubmitting
							? "PROCESSING..."
							: editingId
								? "UPDATE POCKET"
								: "CREATE POCKET"}
					</button>
				</form>
			</div>
		</div>
	);
};
