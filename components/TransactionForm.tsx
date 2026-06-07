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
import { TransactionFormDetails } from "./TransactionFormDetails";
import { TransactionFormFooter } from "./TransactionFormFooter";

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
				? buildSubscriptionPayload({
						shopName: form.shopName,
						amount: form.amount,
						currency: form.currency,
						accountId: form.accountId,
						categoryId: form.categoryId,
						frequency: form.frequency,
						date: form.date,
					})
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
					<TransactionFormDetails form={form} />

					{/* Historical Checkboxes */}
					<TransactionFormHistorical form={form} />

					{/* Amount Breakdown Section */}
					<TransactionFormBreakdown form={form} />
				</form>

				<TransactionFormFooter
					validationError={validationError}
					isSubmitting={isSubmitting}
					onSubmit={handleSubmit}
				/>
			</div>
		</div>
	);
};

export default TransactionForm;
