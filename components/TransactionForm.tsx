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
import {
	XMarkIcon,
	PlusIcon,
	ExclamationTriangleIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";
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

	const filteredPots = pots.filter((p) => p.accountId === form.accountId);
	const selectedPot = filteredPots.find((p) => p.id === form.potId);
	const isPotLow =
		selectedPot &&
		(selectedPot.amountLeft <= 0 ||
			selectedPot.amountLeft / selectedPot.limitAmount <= 0.1);

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
					<div className="grid grid-cols-1 gap-4">
						<div>
							<label className="block text-xs font-medium text-gray-400 mb-1">
								{form.type === TransactionType.EXPENSE
									? "Deduct From"
									: form.type === TransactionType.INCOME
										? "Deposit To"
										: form.type === TransactionType.TRANSFER
											? "From"
											: "Account"}
							</label>
							<select
								value={form.accountId}
								onChange={(e) => form.resetPotIfAccountChanged(e.target.value)}
								className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none"
							>
								{accounts.map((acc) => (
									<option key={acc.id} value={acc.id}>
										{acc.name} ({acc.currency})
									</option>
								))}
							</select>
						</div>

						{/* Pot Selection (Only if account has pots) */}
						{filteredPots.length > 0 && (
							<div className="animate-fadeIn">
								<label className="text-xs font-medium text-gray-400 mb-1 flex justify-between">
									<span>Spending Limit / Pot (Optional)</span>
									{selectedPot && (
										<span className="text-secondary text-[10px] font-bold">
											AVAILABLE: {form.currency === "MYR" ? "RM" : "$"}{" "}
											{selectedPot.amountLeft.toLocaleString(undefined, {
												minimumFractionDigits: 2,
											})}
										</span>
									)}
								</label>
								<div className="relative">
									<select
										value={form.potId}
										onChange={(e) => form.setPotId(e.target.value)}
										className={`w-full bg-surface border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none transition-colors ${
											isPotLow ? "border-amber-500/50" : "border-gray-700"
										}`}
									>
										<option value="">No Limit / Pot</option>
										{filteredPots.map((p) => (
											<option key={p.id} value={p.id}>
												{p.icon} {p.name} ({form.currency === "MYR" ? "RM" : "$"}
												{p.amountLeft.toLocaleString()} left)
											</option>
										))}
									</select>
								</div>
								{isPotLow && (
									<div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
										<ExclamationTriangleIcon className="w-3 h-3 shrink-0" />
										<span>
											Limit almost reached (
											{selectedPot?.amountLeft <= 0
												? "Exceeded"
												: "Less than 10% left"}
											)
										</span>
									</div>
								)}
							</div>
						)}

						{/* Saving Pocket */}
						{(form.type === TransactionType.EXPENSE ||
							form.type === TransactionType.INCOME ||
							form.type === TransactionType.TRANSFER) &&
							pockets.length > 0 && (
								<div className="animate-fadeIn space-y-4">
									<div>
										<label className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-2">
											<SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
											<span>
												{form.type === TransactionType.TRANSFER
													? "Source Pocket (Optional)"
													: "Saving Pocket (Optional)"}
											</span>
										</label>
										<div className="relative">
											<select
												value={form.savingPocketId}
												onChange={(e) => form.setSavingPocketId(e.target.value)}
												className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none transition-colors"
											>
												<option value="">No Pocket Selected</option>
												{pockets
													.filter(
														(p) => !p.accountId || p.accountId === form.accountId,
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

									{form.type === TransactionType.EXPENSE && form.savingPocketId && (
										<p className="mt-1 text-[9px] text-gray-500 italic">
											This will deduct from the pocket balance.
										</p>
									)}
									{form.type === TransactionType.INCOME && form.savingPocketId && (
										<p className="mt-1 text-[9px] text-indigo-400 font-medium italic">
											This will add to your pocket savings!
										</p>
									)}
									{form.type === TransactionType.TRANSFER &&
										(form.savingPocketId || form.toSavingPocketId) && (
											<p className="mt-1 text-[9px] text-indigo-400 font-medium italic">
												Balances will be updated for the selected pockets.
											</p>
										)}
								</div>
							)}

						{form.type === TransactionType.TRANSFER && (
							<div>
								<label className="block text-xs font-medium text-gray-400 mb-1">
									To
								</label>
								<select
									value={form.toAccountId}
									onChange={(e) => form.setToAccountId(e.target.value)}
									className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none"
								>
									{accounts
										.filter((a) => a.id !== form.accountId)
										.map((acc) => (
											<option key={acc.id} value={acc.id}>
												{acc.name}
											</option>
										))}
								</select>
							</div>
						)}
					</div>

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
