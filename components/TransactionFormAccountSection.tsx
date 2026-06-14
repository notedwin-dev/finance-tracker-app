import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { Account, Pot, SavingPocket } from "../types";
import { TransactionType } from "../types";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";
import { TransactionFormPocketSelect } from "./TransactionFormPocketSelect";

const currencySymbol = (c: string) => (c === "MYR" ? "RM" : "$");

const accountLabel = (type: TransactionType): string => {
	switch (type) {
		case TransactionType.EXPENSE:
			return "Deduct From";
		case TransactionType.INCOME:
			return "Deposit To";
		case TransactionType.TRANSFER:
			return "From";
		default:
			return "Account";
	}
};

const pocketLabel = (type: TransactionType): string =>
	type === TransactionType.TRANSFER ? "Source Pocket (Optional)" : "Saving Pocket (Optional)";

const pocketHint = (
	type: TransactionType,
	hasSrc: boolean,
	hasDest: boolean,
): string | null => {
	if (type === TransactionType.EXPENSE && hasSrc) {
		return "This will deduct from the pocket balance.";
	}
	if (type === TransactionType.INCOME && hasSrc) {
		return "This will add to your pocket savings!";
	}
	if (type === TransactionType.TRANSFER && (hasSrc || hasDest)) {
		return "Balances will be updated for the selected pockets.";
	}
	return null;
};

const getPotWarningMessage = (selectedPot: Pot | undefined): string | null => {
	if (!selectedPot) return null;
	if (selectedPot.amountLeft <= 0) return "Limit almost reached (Exceeded)";
	return "Limit almost reached (Less than 10% left)";
};

const isPotLow = (pot: Pot | undefined): boolean => {
	if (!pot) return false;
	return pot.amountLeft <= 0 || pot.amountLeft / pot.limitAmount <= 0.1;
};

type Props = {
	form: TransactionFormState & TransactionFormActions;
	accounts: Account[];
	pots: Pot[];
	pockets: SavingPocket[];
};

const AccountDropdown: React.FC<{
	label: string;
	value: string;
	accounts: Account[];
	excludeId?: string;
	onChange: (id: string) => void;
}> = ({ label, value, accounts, excludeId, onChange }) => (
	<div>
		<label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none"
		>
			{accounts
				.filter((a) => a.id !== excludeId)
				.map((acc) => (
					<option key={acc.id} value={acc.id}>
						{acc.name} {excludeId ? "" : `(${acc.currency})`}
					</option>
				))}
		</select>
	</div>
);

const PotDropdown: React.FC<{
	form: TransactionFormState & TransactionFormActions;
	filteredPots: Pot[];
	selectedPot: Pot | undefined;
	showWarning: boolean;
}> = ({ form, filteredPots, selectedPot, showWarning }) => (
	<div className="animate-fadeIn">
		<label className="text-xs font-medium text-gray-400 mb-1 flex justify-between">
			<span>Spending Limit / Pot (Optional)</span>
			{selectedPot && (
				<span className="text-secondary text-[10px] font-bold">
					AVAILABLE: {currencySymbol(form.currency)}{" "}
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
					showWarning ? "border-amber-500/50" : "border-gray-700"
				}`}
			>
				<option value="">No Limit / Pot</option>
				{filteredPots.map((p) => (
					<option key={p.id} value={p.id}>
						{p.icon} {p.name} ({currencySymbol(form.currency)}
						{p.amountLeft.toLocaleString()} left)
					</option>
				))}
			</select>
		</div>
		{showWarning && (
			<div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
				<ExclamationTriangleIcon className="w-3 h-3 shrink-0" />
				<span>{getPotWarningMessage(selectedPot)}</span>
			</div>
		)}
	</div>
);

const PocketDropdown: React.FC<{
	form: TransactionFormState & TransactionFormActions;
	pockets: SavingPocket[];
	hint: string | null;
}> = ({ form, pockets, hint }) => {
	const availablePockets = pockets.filter(
		(p) => !p.accountId || p.accountId === form.accountId,
	);

	return (
		<div className="animate-fadeIn space-y-4">
			<TransactionFormPocketSelect
				label={pocketLabel(form.type)}
				value={form.savingPocketId}
				pockets={availablePockets}
				onChange={form.setSavingPocketId}
				iconClassName="text-indigo-400"
			/>
			{hint && (
				<p className="mt-1 text-[9px] text-indigo-400 font-medium italic">
					{hint}
				</p>
			)}
		</div>
	);
};

export const TransactionFormAccountSection = ({
	form,
	accounts,
	pots,
	pockets,
}: Props) => {
	const filteredPots = pots.filter((p) => p.accountId === form.accountId);
	const selectedPot = filteredPots.find((p) => p.id === form.potId);
	const showPocketSection =
		(form.type === TransactionType.EXPENSE ||
			form.type === TransactionType.INCOME ||
			form.type === TransactionType.TRANSFER) &&
		pockets.length > 0;
	const showToAccount = form.type === TransactionType.TRANSFER;
	const showPotSection = filteredPots.length > 0;
	const hint = pocketHint(
		form.type,
		!!form.savingPocketId,
		!!form.toSavingPocketId,
	);

	return (
		<div className="grid grid-cols-1 gap-4">
			<AccountDropdown
				label={accountLabel(form.type)}
				value={form.accountId}
				accounts={accounts}
				onChange={form.resetPotIfAccountChanged}
			/>
			{showPotSection && (
				<PotDropdown
					form={form}
					filteredPots={filteredPots}
					selectedPot={selectedPot}
					showWarning={isPotLow(selectedPot)}
				/>
			)}
			{showPocketSection && (
				<PocketDropdown form={form} pockets={pockets} hint={hint} />
			)}
			{showToAccount && (
				<AccountDropdown
					label="To"
					value={form.toAccountId}
					accounts={accounts}
					excludeId={form.accountId}
					onChange={form.setToAccountId}
				/>
			)}
		</div>
	);
};
