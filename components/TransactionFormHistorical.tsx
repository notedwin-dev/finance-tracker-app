import { TransactionType } from "../types";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";

type Props = {
	form: TransactionFormState & TransactionFormActions;
};

const historicalLabel = (type: TransactionType) =>
	type === TransactionType.TRANSFER
		? "Source Account: Historical Record"
		: "Historical Record (No Balance Change)";

const historicalHint = (type: TransactionType) =>
	type === TransactionType.TRANSFER
		? "Historical transfers will not change the balance of their respective accounts. You can set this individually for each side of the transfer."
		: "This will add the transaction to your history without affecting your current account balance. Perfect for old records.";

export const TransactionFormHistorical = ({ form }: Props) => (
	<div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 space-y-4">
		<div className="space-y-3">
			<div className="flex items-center gap-3">
				<input
					type="checkbox"
					id="isHistorical"
					checked={form.isHistorical}
					onChange={(e) => form.setIsHistorical(e.target.checked)}
					className="w-4 h-4 rounded border-gray-700 bg-surface text-primary focus:ring-primary"
				/>
				<label
					htmlFor="isHistorical"
					className="text-xs font-bold text-amber-200 cursor-pointer"
				>
					{historicalLabel(form.type)}
				</label>
			</div>

			{form.type === TransactionType.TRANSFER && (
				<div className="flex items-center gap-3">
					<input
						type="checkbox"
						id="isToAccountHistorical"
						checked={form.isToAccountHistorical}
						onChange={(e) => form.setIsToAccountHistorical(e.target.checked)}
						className="w-4 h-4 rounded border-gray-700 bg-surface text-primary focus:ring-primary"
					/>
					<label
						htmlFor="isToAccountHistorical"
						className="text-xs font-bold text-amber-200 cursor-pointer"
					>
						Destination Account: Historical Record
					</label>
				</div>
			)}
		</div>

		<p className="text-[10px] text-amber-200/60 leading-relaxed font-medium pl-7">
			{historicalHint(form.type)}
		</p>
	</div>
);
