import {
	Transaction,
	TransactionType,
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

const buildLinkedFields = (t: Transaction | undefined) => ({
	linkedTransactionId: t?.linkedTransactionId,
	transferDirection: t?.transferDirection,
});

const buildIdentificationFields = (
	t: Transaction | undefined,
): Pick<Transaction, "id" | "createdAt"> => ({
	id: t?.id || crypto.randomUUID(),
	createdAt: t?.createdAt || new Date().toISOString(),
});

const buildAccountLinks = (
	type: TransactionType,
	args: Pick<PayloadArgs, "potId" | "savingPocketId" | "toSavingPocketId" | "toAccountId">,
) => {
	const isTransfer = type === TransactionType.TRANSFER;
	return {
		potId: args.potId || undefined,
		savingPocketId: args.savingPocketId || undefined,
		toSavingPocketId: isTransfer ? args.toSavingPocketId : undefined,
		toAccountId: isTransfer ? args.toAccountId : undefined,
	};
};

const buildAmountFields = (
	type: TransactionType,
	args: Pick<PayloadArgs, "amount" | "fee" | "feeType" | "isSubsidized" | "marketValue">,
) => {
	const isTransfer = type === TransactionType.TRANSFER;
	const hasFee = isTransfer && !!args.fee;
	const finalAmount = args.isSubsidized ? 0 : Math.abs(parseFloat(args.amount));
	return {
		amount: finalAmount,
		fee: hasFee ? Math.abs(parseFloat(args.fee)) : undefined,
		feeType: hasFee ? args.feeType : undefined,
		marketValue: args.isSubsidized ? parseFloat(args.marketValue) : undefined,
	};
};

const buildCategoryField = (type: TransactionType, categoryId: string): string | undefined => {
	const isExpenseOrIncome =
		type === TransactionType.EXPENSE || type === TransactionType.INCOME;
	return isExpenseOrIncome ? categoryId : undefined;
};

const buildBreakdown = (
	breakdownEnabled: boolean,
	breakdownItems: BreakdownItem[],
) => serializeBreakdownItems(breakdownEnabled, breakdownItems);

export const buildTransactionPayload = (
	args: PayloadArgs,
): Omit<Transaction, "userId"> => {
	const identification = buildIdentificationFields(args.initialTransaction);
	const linked = buildLinkedFields(args.initialTransaction);
	const accountLinks = buildAccountLinks(args.type, args);
	const amount = buildAmountFields(args.type, args);

	return {
		...identification,
		accountId: args.accountId,
		...accountLinks,
		subscriptionId: undefined,
		...amount,
		isSubsidized: args.isSubsidized,
		isHistorical: args.isHistorical,
		currency: args.currency,
		type: args.type,
		categoryId: buildCategoryField(args.type, args.categoryId),
		shopName: args.shopName,
		date: args.date,
		time: args.time || undefined,
		amountBreakdown: buildBreakdown(args.breakdownEnabled, args.breakdownItems),
		...linked,
	};
};

type SubscriptionPayloadArgs = {
	shopName: string;
	amount: string;
	currency: Transaction["currency"];
	accountId: string;
	categoryId: string;
	frequency: import("../../../types").Subscription["frequency"];
	date: string;
};

export const buildSubscriptionPayload = (args: SubscriptionPayloadArgs) => ({
	name: args.shopName || "New Subscription",
	amount: Math.abs(parseFloat(args.amount)),
	currency: args.currency,
	accountId: args.accountId,
	categoryId: args.categoryId,
	frequency: args.frequency,
	nextPaymentDate: args.date,
	active: true,
});
