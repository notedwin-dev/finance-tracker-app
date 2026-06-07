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
	ChevronDownIcon,
	ChevronUpIcon,
	TrashIcon as TrashIconOutline,
	ArrowPathIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";
import DatePicker from "./DatePicker";
import { formatCalculatorAmount } from "../helpers/amount-calculator";
import { validateTransactionForm } from "../src/lib/domain/transaction-form.validation";
import {
	buildTransactionPayload,
	buildSubscriptionPayload,
} from "../src/lib/domain/transaction-payload";
import { useTransactionFormState } from "./useTransactionFormState";

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

const FREQUENCIES: Subscription["frequency"][] = [
	"DAILY",
	"WEEKLY",
	"MONTHLY",
	"YEARLY",
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
								onChange={(e) => handleAmountChange(e.target.value)}
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
										{form.currency === "MYR" ? "RM" : "$"}
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
								{parseFloat(form.fee) > 0 && (
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
								{parseFloat(form.fee) > 0 && parseFloat(form.amount) > 0 && (
									<p className="mt-1 text-[10px] text-gray-500 italic">
										{form.feeType === "INCLUSIVE"
											? `Amount includes fee. Source pays ${parseFloat(
													form.amount,
												).toFixed(
													2,
												)} ${form.currency}, Destination receives ${parseFloat(
													form.amount,
												).toFixed(2)} ${form.currency}.`
											: `Fee is excluded from received amount. Source pays ${parseFloat(
													form.amount,
												).toFixed(2)} ${form.currency}, Destination receives ${(
													parseFloat(form.amount) - parseFloat(form.fee)
												).toFixed(2)} ${form.currency}.`}
									</p>
								)}
							</div>
						</div>
					)}

					{/* Category Selection (Expense & Income) */}
					{(form.type === TransactionType.EXPENSE ||
						form.type === TransactionType.INCOME) && (
						<div>
							<div className="flex justify-between items-center mb-1">
								<label className="block text-xs font-medium text-gray-400">
									Category
								</label>
								<button
									type="button"
									onClick={onManageCategories}
									className="text-[10px] text-primary hover:text-white font-bold flex items-center gap-1"
								>
									<PlusIcon className="w-3 h-3" /> Manage
								</button>
							</div>
							<div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
								{categories.map((cat) => (
									<button
										key={cat.id}
										type="button"
										onClick={() => form.setCategoryId(cat.id)}
										className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square sm:aspect-auto sm:min-h-15 ${
											form.categoryId === cat.id
												? "bg-primary text-white border-primary"
												: "bg-surface border-gray-800 text-gray-400 hover:border-gray-600"
										}`}
									>
										<span className="text-xl sm:text-lg">{cat.icon}</span>
										<span className="text-[8px] sm:text-[9px] font-medium truncate w-full text-center mt-1">
											{cat.name}
										</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Subscription Linking */}
					{form.type === TransactionType.EXPENSE && (
						<div className="space-y-3 bg-white/5 p-3 rounded-2xl border border-gray-800">
							<div className="flex items-center justify-between">
								<label className="text-xs font-medium text-gray-400 flex items-center gap-2">
									<ArrowPathIcon className="w-3.5 h-3.5" />
									Subscription
								</label>
								{!form.subscriptionId && (
									<button
										type="button"
										onClick={() => form.setIsSubscription(!form.isSubscription)}
										className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
											form.isSubscription
												? "bg-primary/20 text-primary border border-primary/30"
												: "text-gray-500 border border-gray-800"
										}`}
									>
										{form.isSubscription ? "CREATE NEW" : "SET AS REPEATING"}
									</button>
								)}
							</div>

							{form.isSubscription && !form.subscriptionId && (
								<div className="animate-fadeIn space-y-3">
									<div className="flex gap-2">
										{FREQUENCIES.map((f) => (
											<button
												key={f}
												type="button"
												onClick={() => form.setFrequency(f)}
												className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg border transition-all ${
													form.frequency === f
														? "bg-primary border-primary text-white"
														: "bg-surface border-gray-700 text-gray-400"
												}`}
											>
												{f}
											</button>
										))}
									</div>
									<p className="text-[10px] text-gray-500 italic">
										This will create a new subscription starting from {form.date}.
									</p>
								</div>
							)}

							{subscriptions.length > 0 && !form.isSubscription && (
								<div className="relative">
									<select
										value={form.subscriptionId}
										onChange={(e) => {
											const subId = e.target.value;
											form.setSubscriptionId(subId);
											if (subId) {
												const sub = subscriptions.find((s) => s.id === subId);
												if (sub) form.applySubscription(sub);
											}
										}}
										className="w-full bg-surface border border-gray-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary appearance-none"
									>
										<option value="">Link existing subscription...</option>
										{subscriptions.map((sub) => (
											<option key={sub.id} value={sub.id}>
												{sub.name} ({sub.currency} {sub.amount.toLocaleString()}
												) - {sub.frequency}
											</option>
										))}
									</select>
									{form.subscriptionId && (
										<button
											type="button"
											onClick={() => form.setSubscriptionId("")}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
										>
											<XMarkIcon className="w-4 h-4" />
										</button>
									)}
								</div>
							)}
						</div>
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
									{form.type === TransactionType.TRANSFER
										? "Source Account: Historical Record"
										: "Historical Record (No Balance Change)"}
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
							{form.type === TransactionType.TRANSFER
								? "Historical transfers will not change the balance of their respective accounts. You can set this individually for each side of the transfer."
								: "This will add the transaction to your history without affecting your current account balance. Perfect for old records."}
						</p>
					</div>

					{/* Amount Breakdown Section */}
					<div className="border-t border-gray-800 pt-5">
						<button
							type="button"
							onClick={() => form.setBreakdownEnabled(!form.breakdownEnabled)}
							className="flex items-center justify-between w-full text-xs font-bold text-gray-400 mb-3 hover:text-white transition-colors"
						>
							<span className="flex items-center gap-2">
								<PlusIcon className="w-3 h-3" />
								Add Amount Breakdown
							</span>
							{form.breakdownEnabled ? (
								<ChevronUpIcon className="w-4 h-4" />
							) : (
								<ChevronDownIcon className="w-4 h-4" />
							)}
						</button>

						{form.breakdownEnabled && (
							<div className="space-y-3 animate-fadeIn mb-4">
								{form.breakdownItems.map((item) => (
									<div key={item.id} className="flex gap-2 items-center group">
										<input
											type="text"
											placeholder="e.g., Burger"
											value={item.description}
											onChange={(e) =>
												form.updateBreakdownItem(
													item.id,
													"description",
													e.target.value,
												)
											}
											className="flex-1 min-w-0 bg-gray-900/50 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary transition-all"
										/>
										<div className="w-24 shrink-0">
											<input
												type="text"
												inputMode="decimal"
												placeholder="0.00"
												value={item.amount || ""}
												onChange={(e) =>
													form.updateBreakdownItem(
														item.id,
														"amount",
														formatCalculatorAmount(e.target.value, item.amount),
													)
												}
												className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary text-right font-mono"
											/>
										</div>
										<button
											type="button"
											onClick={() => form.removeBreakdownItem(item.id)}
											className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
										>
											<TrashIconOutline className="w-4 h-4" />
										</button>
									</div>
								))}

								<button
									type="button"
									onClick={form.addBreakdownItem}
									className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
								>
									<PlusIcon className="w-3 h-3" /> Add Item
								</button>

								{form.breakdownItems.length > 0 && (
									<div className="flex justify-between items-center px-3 py-3 bg-gray-900/40 rounded-xl border border-gray-800">
										<div className="flex flex-col">
											<span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
												Allocated
											</span>
											<span className="text-xs font-mono font-bold text-indigo-400">
												{form.currency === "MYR" ? "RM" : "$"}{" "}
												{form.breakdownItems
													.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
													.toLocaleString(undefined, {
														minimumFractionDigits: 2,
													})}
											</span>
										</div>

										<div className="flex flex-col text-right">
											<span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
												Remaining
											</span>
											<span
												className={`text-xs font-mono font-bold ${
													parseFloat(form.amount || "0") -
														form.breakdownItems.reduce(
															(s, i) => s + (parseFloat(i.amount) || 0),
															0,
														) <
													0
														? "text-red-500"
														: "text-gray-400"
												}`}
											>
												{form.currency === "MYR" ? "RM" : "$"}{" "}
												{(
													parseFloat(form.amount || "0") -
													form.breakdownItems.reduce(
														(s, i) => s + (parseFloat(i.amount) || 0),
														0,
													)
												).toLocaleString(undefined, {
													minimumFractionDigits: 2,
												})}
											</span>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
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
