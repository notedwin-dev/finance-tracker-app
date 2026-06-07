import {
	Account,
	Category,
	Transaction,
	TransactionType,
	Subscription,
} from "../../../types";
import { serializeBreakdownItems } from "../../lib/domain/transaction-form.validation";

type BreakdownItem = { id: string; description: string; amount: string };

type PayloadArgs = {
	initialTransaction?: Transaction;
	type: TransactionType;
	accountId: string;
	potId: string;
	savingPocketId: string;
	toSavingPocketId: string;
	toAccountId: string;
	amount: string;
	currency: Transaction["currency"];
	categoryId: string;
	shopName: string;
	date: string;
	time: string;
	fee: string;
	feeType: "INCLUSIVE" | "EXCLUSIVE";
	isSubsidized: boolean;
	marketValue: string;
	isHistorical: boolean;
	breakdownEnabled: boolean;
	breakdownItems: BreakdownItem[];
};

export const buildTransactionPayload = (
	args: PayloadArgs,
): Omit<Transaction, "userId"> => {
	const {
		initialTransaction,
		type,
		accountId,
		potId,
		savingPocketId,
		toSavingPocketId,
		toAccountId,
		amount,
		currency,
		categoryId,
		shopName,
		date,
		time,
		fee,
		feeType,
		isSubsidized,
		marketValue,
		isHistorical,
		breakdownEnabled,
		breakdownItems,
	} = args;

	const isTransfer = type === TransactionType.TRANSFER;
	const isExpenseOrIncome =
		type === TransactionType.EXPENSE || type === TransactionType.INCOME;

	return {
		id: initialTransaction?.id || crypto.randomUUID(),
		accountId,
		potId: potId || undefined,
		savingPocketId: savingPocketId || undefined,
		toSavingPocketId: isTransfer ? toSavingPocketId : undefined,
		subscriptionId: undefined,
		toAccountId: isTransfer ? toAccountId : undefined,
		amount: isSubsidized ? 0 : Math.abs(parseFloat(amount)),
		isSubsidized,
		marketValue: isSubsidized ? parseFloat(marketValue) : undefined,
		isHistorical,
		fee: isTransfer && fee ? Math.abs(parseFloat(fee)) : undefined,
		feeType: isTransfer && fee ? feeType : undefined,
		currency,
		type,
		categoryId: isExpenseOrIncome ? categoryId : undefined,
		shopName,
		date,
		time: time || undefined,
		amountBreakdown: serializeBreakdownItems(breakdownEnabled, breakdownItems),
		createdAt: initialTransaction?.createdAt || new Date().toISOString(),
		linkedTransactionId: initialTransaction?.linkedTransactionId,
		transferDirection: initialTransaction?.transferDirection,
	};
};

export const buildSubscriptionPayload = (
	shopName: string,
	amount: string,
	currency: Transaction["currency"],
	accountId: string,
	categoryId: string,
	frequency: Subscription["frequency"],
	date: string,
): Omit<Subscription, "userId" | "id"> => ({
	name: shopName || "New Subscription",
	amount: Math.abs(parseFloat(amount)),
	currency,
	accountId,
	categoryId,
	frequency,
	nextPaymentDate: date,
	active: true,
});
