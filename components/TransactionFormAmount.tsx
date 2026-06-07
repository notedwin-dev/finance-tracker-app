import { SparklesIcon } from "@heroicons/react/24/outline";
import { TransactionType } from "../types";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";

const currencySymbol = (c: string) => (c === "MYR" ? "RM" : "$");

type Props = {
	form: TransactionFormState & TransactionFormActions;
	onAmountChange: (value: string) => void;
};

export const TransactionFormAmount = ({ form, onAmountChange }: Props) => (
	<div>
		<label className="block text-xs font-medium text-gray-400 mb-1.5">
			{form.isSubsidized ? "Cash Outflow (Usually 0.00)" : "Amount"}
		</label>
		<div className="flex gap-2">
			<select
				value={form.currency}
				onChange={(e) => form.setCurrency(e.target.value as any)}
				className="bg-surface border border-gray-700 rounded-xl px-2 sm:px-3 text-white text-sm sm:text-base font-bold focus:outline-none shrink-0"
			>
				<option value="MYR">MYR</option>
				<option value="USD">USD</option>
			</select>
			<input
				type="text"
				inputMode="decimal"
				required={!form.isSubsidized}
				value={form.amount}
				onChange={(e) => onAmountChange(e.target.value)}
				className="flex-1 min-w-0 bg-surface border border-gray-700 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-white text-lg sm:text-xl font-bold focus:outline-none focus:border-primary"
				placeholder="0.00"
				autoFocus
			/>
		</div>
		{form.isSubsidized && (
			<div className="mt-3 animate-fadeIn">
				<label className="block text-xs font-medium text-indigo-400 mb-1.5">
					Market Value (Original Price)
				</label>
				<div className="relative">
					<div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
						{currencySymbol(form.currency)}
					</div>
					<input
						type="text"
						inputMode="decimal"
						value={form.marketValue}
						onChange={(e) => form.setMarketValue(e.target.value)}
						className="w-full bg-surface border border-indigo-500/30 rounded-xl py-2.5 px-10 text-white font-bold focus:outline-none focus:border-indigo-500"
						placeholder="0.00"
					/>
				</div>
				<p className="mt-1 text-[10px] text-gray-400 italic">
					Value received from subsidy/gift.
				</p>
			</div>
		)}
		{form.type === TransactionType.EXPENSE && (
			<div className="mt-2 text-right">
				<button
					type="button"
					onClick={() => form.setIsSubsidized(!form.isSubsidized)}
					className={`inline-flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${
						form.isSubsidized
							? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
							: "text-gray-500 hover:text-white"
					}`}
				>
					<SparklesIcon className="w-3 h-3" />
					{form.isSubsidized ? "SUBSIDIZED" : "MARK AS SUBSIDIZED"}
				</button>
			</div>
		)}
	</div>
);
