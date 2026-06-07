import { useState, useEffect } from "react";
import {
	Account,
	Category,
	TransactionType,
	Transaction,
	Currency,
	Pot,
	SavingPocket,
	AmountBreakdownItem,
	Subscription,
	SubscriptionFrequency,
} from "../types";

export type TransactionFormState = {
	type: TransactionType;
	amount: string;
	currency: Currency;
	accountId: string;
	potId: string;
	savingPocketId: string;
	toSavingPocketId: string;
	fee: string;
	feeType: "INCLUSIVE" | "EXCLUSIVE";
	subscriptionId: string;
	isSubscription: boolean;
	frequency: SubscriptionFrequency;
	toAccountId: string;
	categoryId: string;
	shopName: string;
	date: string;
	time: string;
	breakdownEnabled: boolean;
	breakdownItems: Array<{ id: string; description: string; amount: string }>;
	isSubsidized: boolean;
	marketValue: string;
	isHistorical: boolean;
	isToAccountHistorical: boolean;
};

export type TransactionFormActions = {
	setType: (t: TransactionType) => void;
	setAmount: (v: string) => void;
	setCurrency: (v: Currency) => void;
	setAccountId: (v: string) => void;
	setPotId: (v: string) => void;
	setSavingPocketId: (v: string) => void;
	setToSavingPocketId: (v: string) => void;
	setFee: (v: string) => void;
	setFeeType: (v: "INCLUSIVE" | "EXCLUSIVE") => void;
	setSubscriptionId: (v: string) => void;
	setIsSubscription: (v: boolean) => void;
	setFrequency: (v: SubscriptionFrequency) => void;
	setToAccountId: (v: string) => void;
	setCategoryId: (v: string) => void;
	setShopName: (v: string) => void;
	setDate: (v: string) => void;
	setTime: (v: string) => void;
	setBreakdownEnabled: (v: boolean) => void;
	setBreakdownItems: (
		v: Array<{ id: string; description: string; amount: string }>,
	) => void;
	setIsSubsidized: (v: boolean) => void;
	setMarketValue: (v: string) => void;
	setIsHistorical: (v: boolean) => void;
	setIsToAccountHistorical: (v: boolean) => void;
	applySubscription: (sub: Subscription) => void;
	addBreakdownItem: () => void;
	removeBreakdownItem: (id: string) => void;
	updateBreakdownItem: (
		id: string,
		field: keyof AmountBreakdownItem,
		value: any,
	) => void;
	resetPotIfAccountChanged: (nextAccountId: string) => void;
};

const formatInitialNumber = (val: number | string | undefined): string => {
	if (typeof val === "number") return val.toFixed(2);
	return String(val || "0.00");
};

const formatInitialOptional = (val: number | string | undefined): string => {
	if (typeof val === "number") return val.toFixed(2);
	return String(val || "");
};

export const useTransactionFormState = (
	accounts: Account[],
	categories: Category[],
	initialTransaction: Transaction | undefined,
	pockets: SavingPocket[],
): TransactionFormState & TransactionFormActions => {
	const [type, setType] = useState<TransactionType>(
		initialTransaction ? initialTransaction.type : TransactionType.EXPENSE,
	);
	const [amount, setAmount] = useState(
		initialTransaction
			? formatInitialNumber(initialTransaction.amount)
			: "",
	);
	const [currency, setCurrency] = useState<Currency>(
		initialTransaction ? initialTransaction.currency : "MYR",
	);
	const [accountId, setAccountId] = useState(
		initialTransaction ? initialTransaction.accountId : accounts[0]?.id || "",
	);
	const [potId, setPotId] = useState(
		initialTransaction ? initialTransaction.potId || "" : "",
	);
	const [savingPocketId, setSavingPocketId] = useState(
		initialTransaction ? initialTransaction.savingPocketId || "" : "",
	);
	const [toSavingPocketId, setToSavingPocketId] = useState(
		initialTransaction ? initialTransaction.toSavingPocketId || "" : "",
	);
	const [fee, setFee] = useState(
		initialTransaction ? formatInitialOptional(initialTransaction.fee) : "",
	);
	const [feeType, setFeeType] = useState<"INCLUSIVE" | "EXCLUSIVE">(
		initialTransaction?.feeType || "INCLUSIVE",
	);
	const [subscriptionId, setSubscriptionId] = useState(
		initialTransaction ? initialTransaction.subscriptionId || "" : "",
	);
	const [isSubscription, setIsSubscription] = useState(false);
	const [frequency, setFrequency] = useState<SubscriptionFrequency>("MONTHLY");
	const [toAccountId, setToAccountId] = useState(
		initialTransaction
			? initialTransaction.toAccountId || ""
			: accounts.length > 1
				? accounts[1].id
				: "",
	);
	const [categoryId, setCategoryId] = useState(
		initialTransaction
			? initialTransaction.categoryId || ""
			: categories[0]?.id || "",
	);
	const [shopName, setShopName] = useState(
		initialTransaction ? initialTransaction.shopName : "",
	);
	const [date, setDate] = useState(
		initialTransaction
			? initialTransaction.date
			: new Date().toLocaleDateString("en-CA"),
	);
	const [time, setTime] = useState(
		initialTransaction ? initialTransaction.time || "" : "",
	);
	const [breakdownEnabled, setBreakdownEnabled] = useState(
		Array.isArray(initialTransaction?.amountBreakdown) &&
			initialTransaction.amountBreakdown.length > 0,
	);
	const [breakdownItems, setBreakdownItems] = useState<
		Array<{ id: string; description: string; amount: string }>
	>(
		Array.isArray(initialTransaction?.amountBreakdown)
			? initialTransaction.amountBreakdown.map((item) => ({
					...item,
					amount: formatInitialNumber(item.amount),
				}))
			: [],
	);
	const [isSubsidized, setIsSubsidized] = useState(
		initialTransaction?.isSubsidized || false,
	);
	const [marketValue, setMarketValue] = useState(
		initialTransaction?.marketValue?.toString() || "",
	);
	const [isHistorical, setIsHistorical] = useState(
		initialTransaction?.isHistorical || false,
	);
	const [isToAccountHistorical, setIsToAccountHistorical] = useState(
		(initialTransaction as any)?.linkedTransaction?.isHistorical ||
			(initialTransaction as any)?.isToAccountHistorical ||
			false,
	);

	useEffect(() => {
		if (!initialTransaction) {
			const acc = accounts.find((a) => a.id === accountId);
			if (acc) setCurrency(acc.currency);
		}
	}, [accountId, accounts, initialTransaction]);

	useEffect(() => {
		if (savingPocketId) {
			const pocket = pockets.find((p) => p.id === savingPocketId);
			if (pocket?.accountId && pocket.accountId !== accountId) {
				setSavingPocketId("");
			}
		}
	}, [accountId, pockets, savingPocketId]);

	useEffect(() => {
		if (toSavingPocketId) {
			const pocket = pockets.find((p) => p.id === toSavingPocketId);
			if (pocket?.accountId && pocket.accountId !== toAccountId) {
				setToSavingPocketId("");
			}
		}
	}, [toAccountId, pockets, toSavingPocketId]);

	const addBreakdownItem = () => {
		setBreakdownItems([
			...breakdownItems,
			{ id: crypto.randomUUID(), description: "", amount: "" },
		]);
	};

	const removeBreakdownItem = (id: string) => {
		setBreakdownItems(breakdownItems.filter((i) => i.id !== id));
	};

	const updateBreakdownItem = (
		id: string,
		field: keyof AmountBreakdownItem,
		value: any,
	) => {
		setBreakdownItems(
			breakdownItems.map((item) =>
				item.id === id ? { ...item, [field]: value } : item,
			),
		);
	};

	const applySubscription = (sub: Subscription) => {
		setCategoryId(sub.categoryId);
		setAmount(formatInitialNumber(sub.amount));
		setCurrency(sub.currency);
		if (!shopName) setShopName(sub.name);
	};

	const resetPotIfAccountChanged = (nextAccountId: string) => {
		setAccountId(nextAccountId);
		setPotId("");
	};

	return {
		type,
		amount,
		currency,
		accountId,
		potId,
		savingPocketId,
		toSavingPocketId,
		fee,
		feeType,
		subscriptionId,
		isSubscription,
		frequency,
		toAccountId,
		categoryId,
		shopName,
		date,
		time,
		breakdownEnabled,
		breakdownItems,
		isSubsidized,
		marketValue,
		isHistorical,
		isToAccountHistorical,
		setType,
		setAmount,
		setCurrency,
		setAccountId,
		setPotId,
		setSavingPocketId,
		setToSavingPocketId,
		setFee,
		setFeeType,
		setSubscriptionId,
		setIsSubscription,
		setFrequency,
		setToAccountId,
		setCategoryId,
		setShopName,
		setDate,
		setTime,
		setBreakdownEnabled,
		setBreakdownItems,
		setIsSubsidized,
		setMarketValue,
		setIsHistorical,
		setIsToAccountHistorical,
		applySubscription,
		addBreakdownItem,
		removeBreakdownItem,
		updateBreakdownItem,
		resetPotIfAccountChanged,
	};
};
