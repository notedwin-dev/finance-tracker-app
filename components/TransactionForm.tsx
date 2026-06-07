import React, { useState } from "react";
import {
	Account,
	Category,
	TransactionType,
	Transaction,
	Pot,
	SavingPocket,
	AmountBreakdownItem,
	Subscription,
} from "../types";
import { XMarkIcon } from "@heroicons/react/24/outline";
import DatePicker from "./DatePicker";
import { formatCalculatorAmount } from "../helpers/amount-calculator";
import { validateTransactionForm } from "../src/lib/domain/transaction-form.validation";
import {
	buildTransactionPayload,
	buildSubscriptionPayload,
} from "../src/lib/domain/transaction-payload";
import { useTransactionFormState } from "./useTransactionFormState";
import { TransactionFormBreakdown } from "./TransactionFormBreakdown";
import { TransactionFormSubscription } from "./TransactionFormSubscription";
import { TransactionFormTransferDetails } from "./TransactionFormTransferDetails";
import { TransactionFormAmount } from "./TransactionFormAmount";
import { TransactionFormCategory } from "./TransactionFormCategory";
import { TransactionFormHistorical } from "./TransactionFormHistorical";
import { TransactionFormAccountSection } from "./TransactionFormAccountSection";

interface Props {
	accounts: Account[];
	categories: Category[];
	pots?: Pot[];
	pockets?: SavingPocket[];
	subscriptions?: Subscription[];
	initialTransaction?: Transaction;
	onClose: () => void;
	onSubmit: (
		transaction: Omit<Transaction, "userId">,
		newSubscription?: Omit<Subscription, "userId" | "id">,
		isDestHistorical?: boolean,
	) => void;
	onManageCategories: () => void;
}

const TRANSACTION_TYPES: TransactionType[] = [
	TransactionType.EXPENSE,
	TransactionType.INCOME,
	TransactionType.TRANSFER,
];

const ALL_TRANSACTION_TYPES: TransactionType[] = [
	TransactionType.EXPENSE,
	TransactionType.INCOME,
	TransactionType.TRANSFER,
	TransactionType.ADJUSTMENT,
	TransactionType.ACCOUNT_OPENING,
];

const TransactionForm: React.FC<Props> = ({
	accounts,
	categories,
	pots = [],
	pockets = [],
	subscriptions = [],
	initialTransaction,
	onClose,
	onSubmit,
	onManageCategories,
}) => {
	const form = useTransactionFormState(accounts, categories, initialTransaction, pockets);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleAmountChange = (val: string) => {
		form.setAmount(formatCalculatorAmount(val, form.amount));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;

		setValidationError(null);

		const error = validateTransactionForm({
			type: form.type,
			amount: form.amount,
			marketValue: form.marketValue,
			accountId: form.accountId,
			toAccountId: form.toAccountId,
			categoryId: form.categoryId,
			date: form.date,
			isSubsidized: form.isSubsidized,
			breakdownEnabled: form.breakdownEnabled,
			breakdownItems: form.breakdownItems,
		});
		if (error) {
			setValidationError(error);
			return;
		}

		setIsSubmitting(true);
		try {
			const txData = buildTransactionPayload({
				initialTransaction,
				type: form.type,
				accountId: form.accountId,
				potId: form.potId,
				savingPocketId: form.savingPocketId,
				toSavingPocketId: form.toSavingPocketId,
				toAccountId: form.toAccountId,
				amount: form.amount,
				currency: form.currency,
				categoryId: form.categoryId,
				shopName: form.shopName,
				date: form.date,
				time: form.time,
				fee: form.fee,
				feeType: form.feeType,
				isSubsidized: form.isSubsidized,
				marketValue: form.marketValue,
				isHistorical: form.isHistorical,
				breakdownEnabled: form.breakdownEnabled,
				breakdownItems: form.breakdownItems,
			});

			const newSubData = form.isSubscription
				? buildSubscriptionPayload(
						form.shopName,
						form.amount,
						form.currency,
						form.accountId,
						form.categoryId,
						form.frequency,
						form.date,
					)
				: undefined;

			await onSubmit(
				txData,
				newSubData,
				form.type === TransactionType.TRANSFER
					? form.isToAccountHistorical
					: undefined,
			);
			onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 md:p-6">
			<div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
				<div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-700 bg-surface">
					<h2 className="text-base sm:text-lg font-bold text-white">
						{initialTransaction ? "Edit Transaction" : "New Transaction"}
					</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-white transition-colors p-1"
					>
						<XMarkIcon className="w-6 h-6" />
					</button>
				</div>

				{!initialTransaction && (
					<div className="p-1.5 flex gap-1 bg-surface m-3 sm:m-4 rounded-xl border border-gray-800">
						{TRANSACTION_TYPES.map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => form.setType(t)}
								className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
									form.type === t
										? "bg-primary text-white shadow"
										: "text-gray-400 hover:text-white hover:bg-white/5"
								}`}
							>
								{t}
							</button>
						))}
					</div>
				)}

				<form
					onSubmit={handleSubmit}
					className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1 custom-scrollbar pb-10 sm:pb-5"
				>
					{/* Transaction Type Dropdown (Edit Mode Only) */}
					{initialTransaction && (
						<div>
							<label className="block text-xs font-medium text-gray-400 mb-1.5">
								Transaction Type
							</label>
							<select
								value={form.type}
								onChange={(e) => form.setType(e.target.value as TransactionType)}
								className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none font-bold"
							>
								{ALL_TRANSACTION_TYPES.map((t) => (
									<option key={t} value={t} className="bg-surface">
										{t.replace("_", " ")}
									</option>
								))}
							</select>
						</div>
					)}

					{/* Amount & Currency */}
					<TransactionFormAmount form={form} onAmountChange={handleAmountChange} />

					{/* Account Selection */}
					<TransactionFormAccountSection
						form={form}
						accounts={accounts}
						pots={pots}
						pockets={pockets}
					/>

					{form.type === TransactionType.TRANSFER && (
						<TransactionFormTransferDetails form={form} pockets={pockets} />
					)}

					{/* Category Selection (Expense & Income) */}
					{(form.type === TransactionType.EXPENSE ||
						form.type === TransactionType.INCOME) && (
						<TransactionFormCategory
							form={form}
							categories={categories}
							onManageCategories={onManageCategories}
						/>
					)}

					{/* Subscription Linking */}
					{form.type === TransactionType.EXPENSE && (
						<TransactionFormSubscription form={form} subscriptions={subscriptions} />
					)}

					{/* Details */}
					<div>
						<label className="block text-xs font-medium text-gray-400 mb-1">
							{form.type === TransactionType.TRANSFER ? "Reference" : "Description"}
						</label>
						<input
							type="text"
							value={form.shopName}
							onChange={(e) => form.setShopName(e.target.value)}
							className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
							placeholder={
								form.type === TransactionType.EXPENSE
									? "e.g., Starbucks"
									: form.type === TransactionType.TRANSFER
										? "e.g., Monthly Rent"
										: "e.g., Paycheck"
							}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-medium text-gray-400 mb-1">
								Date
							</label>
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

					{/* Historical Checkboxes */}
					<TransactionFormHistorical form={form} />

					{/* Amount Breakdown Section */}
					<TransactionFormBreakdown form={form} />
				</form>

				<div className="p-4 border-t border-gray-800 bg-surface">
					{validationError && (
						<p className="text-red-500 text-xs text-center font-medium mb-3 bg-red-500/10 py-2 rounded-lg border border-red-500/20">
							{validationError}
						</p>
					)}
					<button
						onClick={handleSubmit}
						disabled={isSubmitting}
						className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
							isSubmitting
								? "bg-gray-600 cursor-not-allowed"
								: "bg-primary hover:bg-primaryDark shadow-indigo-900/20"
						}`}
					>
						{isSubmitting && (
							<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
						)}
						{isSubmitting ? "Processing..." : "Save Record"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default TransactionForm;
