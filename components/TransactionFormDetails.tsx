import { TransactionType } from "../types";
import DatePicker from "./DatePicker";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";

const descriptionLabel = (type: TransactionType) =>
	type === TransactionType.TRANSFER ? "Reference" : "Description";

const descriptionPlaceholder = (type: TransactionType) => {
	switch (type) {
		case TransactionType.EXPENSE:
			return "e.g., Starbucks";
		case TransactionType.TRANSFER:
			return "e.g., Monthly Rent";
		default:
			return "e.g., Paycheck";
	}
};

type Props = {
	form: TransactionFormState & TransactionFormActions;
};

export const TransactionFormDetails = ({ form }: Props) => (
	<>
		<div>
			<label className="block text-xs font-medium text-gray-400 mb-1">
				{descriptionLabel(form.type)}
			</label>
			<input
				type="text"
				value={form.shopName}
				onChange={(e) => form.setShopName(e.target.value)}
				className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
				placeholder={descriptionPlaceholder(form.type)}
			/>
		</div>

		<div className="grid grid-cols-2 gap-4">
			<div>
				<label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
				<DatePicker value={form.date} onChange={form.setDate} />
			</div>
			<div>
				<label className="block text-xs font-medium text-gray-400 mb-1">
					Time (Optional)
				</label>
				<input
					type="time"
					value={form.time}
					onChange={(e) => form.setTime(e.target.value)}
					className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
				/>
			</div>
		</div>
	</>
);
