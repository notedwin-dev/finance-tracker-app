import type { SavingPocket } from "../types";
import { formatCalculatorAmount } from "../helpers/amount-calculator";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";
import { TransactionFormPocketSelect } from "./TransactionFormPocketSelect";

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
	const destinationPockets = pockets.filter(
		(p) =>
			p.id !== form.savingPocketId &&
			(!p.accountId || p.accountId === form.toAccountId),
	);

	return (
		<div className="animate-fadeIn grid grid-cols-2 gap-4">
			<TransactionFormPocketSelect
				label="Destination Pocket (Optional)"
				value={form.toSavingPocketId}
				pockets={destinationPockets}
				onChange={form.setToSavingPocketId}
				iconClassName="text-emerald-400"
			/>

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
