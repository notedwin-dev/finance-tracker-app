import { SparklesIcon } from "@heroicons/react/24/outline";
import type { SavingPocket } from "../types";
import { formatCalculatorAmount } from "../helpers/amount-calculator";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";

type Props = {
	form: TransactionFormState & TransactionFormActions;
	pockets: SavingPocket[];
};

const buildFeeExplanation = (
	amount: string,
	fee: string,
	feeType: "INCLUSIVE" | "EXCLUSIVE",
	currency: string,
): string => {
	const amt = parseFloat(amount).toFixed(2);
	if (feeType === "INCLUSIVE") {
		return `Amount includes fee. Source pays ${amt} ${currency}, Destination receives ${amt} ${currency}.`;
	}
	const received = (parseFloat(amount) - parseFloat(fee)).toFixed(2);
	return `Fee is excluded from received amount. Source pays ${amt} ${currency}, Destination receives ${received} ${currency}.`;
};

export const TransactionFormTransferDetails = ({ form, pockets }: Props) => {
	const feeAmount = parseFloat(form.fee);
	const amountNum = parseFloat(form.amount);
	const showFeeControls = feeAmount > 0;
	const showFeeExplanation = feeAmount > 0 && amountNum > 0;

	return (
		<div className="animate-fadeIn grid grid-cols-2 gap-4">
			<div>
				<label className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-2">
					<SparklesIcon className="w-3.5 h-3.5 text-emerald-400" />
					<span>Destination Pocket (Optional)</span>
				</label>
				<div className="relative">
					<select
						value={form.toSavingPocketId}
						onChange={(e) => form.setToSavingPocketId(e.target.value)}
						className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none transition-colors"
					>
						<option value="">No Pocket Selected</option>
						{pockets
							.filter(
								(p) =>
									p.id !== form.savingPocketId &&
									(!p.accountId || p.accountId === form.toAccountId),
							)
							.map((p) => (
								<option key={p.id} value={p.id}>
									{p.icon} {p.name} ({p.currency}{" "}
									{p.currentAmount.toLocaleString()})
								</option>
							))}
					</select>
				</div>
			</div>

			<div>
				<label className="block text-xs font-medium text-gray-400 mb-1">
					Transaction Fee (Optional)
				</label>
				<div className="relative">
					<input
						type="text"
						inputMode="decimal"
						value={form.fee}
						onChange={(e) =>
							form.setFee(formatCalculatorAmount(e.target.value, form.fee))
						}
						className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
						placeholder="0.00"
					/>
					{form.fee && (
						<div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase">
							{form.currency}
						</div>
					)}
				</div>
				{showFeeControls && (
					<div className="mt-2 flex items-center gap-2">
						<span className="text-[10px] text-gray-400 uppercase font-bold">
							Fee Type:
						</span>
						<div className="flex bg-card p-1 rounded-lg border border-gray-800">
							<button
								type="button"
								onClick={() => form.setFeeType("INCLUSIVE")}
								className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
									form.feeType === "INCLUSIVE"
										? "bg-primary text-white shadow-lg"
										: "text-gray-500 hover:text-white"
								}`}
							>
								INCLUSIVE
							</button>
							<button
								type="button"
								onClick={() => form.setFeeType("EXCLUSIVE")}
								className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
									form.feeType === "EXCLUSIVE"
										? "bg-primary text-white shadow-lg"
										: "text-gray-500 hover:text-white"
								}`}
							>
								EXCLUSIVE
							</button>
						</div>
					</div>
				)}
				{showFeeExplanation && (
					<p className="mt-1 text-[10px] text-gray-500 italic">
						{buildFeeExplanation(form.amount, form.fee, form.feeType, form.currency)}
					</p>
				)}
			</div>
		</div>
	);
};
