import { useState, useEffect, useCallback } from "react";
import {
	Account,
	Category,
	TransactionType,
	Transaction,
	Currency,
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

const pickInitialString = (val: string | undefined, fallback: string): string =>
	val || fallback;

const pickInitialNumber = (val: number | undefined, fallback: number): number =>
	val ?? fallback;

const defaultBreakdownItems = (
	tx: Transaction | undefined,
): Array<{ id: string; description: string; amount: string }> =>
	Array.isArray(tx?.amountBreakdown)
		? tx.amountBreakdown.map((item) => ({
				...item,
				amount: formatInitialNumber(item.amount),
			}))
		: [];

const initFormState = (
	accounts: Account[],
	categories: Category[],
	tx: Transaction | undefined,
): TransactionFormState => ({
	type: tx?.type ?? TransactionType.EXPENSE,
	amount: tx ? formatInitialNumber(tx.amount) : "",
	currency: tx?.currency ?? "MYR",
	accountId: tx?.accountId ?? accounts[0]?.id ?? "",
	potId: tx?.potId ?? "",
	savingPocketId: tx?.savingPocketId ?? "",
	toSavingPocketId: tx?.toSavingPocketId ?? "",
	fee: tx ? formatInitialOptional(tx.fee) : "",
	feeType: tx?.feeType ?? "INCLUSIVE",
	subscriptionId: tx?.subscriptionId ?? "",
	isSubscription: false,
	frequency: "MONTHLY",
	toAccountId:
		tx?.toAccountId ?? (accounts.length > 1 ? accounts[1].id : ""),
	categoryId: tx?.categoryId ?? categories[0]?.id ?? "",
	shopName: tx?.shopName ?? "",
	date: tx?.date ?? new Date().toLocaleDateString("en-CA"),
	time: tx?.time ?? "",
	breakdownEnabled: Array.isArray(tx?.amountBreakdown) && tx.amountBreakdown.length > 0,
	breakdownItems: defaultBreakdownItems(tx),
	isSubsidized: tx?.isSubsidized ?? false,
	marketValue: tx?.marketValue?.toString() ?? "",
	isHistorical: tx?.isHistorical ?? false,
	isToAccountHistorical:
		(tx as any)?.linkedTransaction?.isHistorical ??
		(tx as any)?.isToAccountHistorical ??
		false,
});

const findPocketAccountMismatch = (
	pockets: SavingPocket[],
	pocketId: string,
	accountId: string,
): boolean => {
	if (!pocketId) return false;
	const pocket = pockets.find((p) => p.id === pocketId);
	return !!(pocket?.accountId && pocket.accountId !== accountId);
};

const setter = <K extends keyof TransactionFormState>(key: K) =>
	<T>(setState: React.Dispatch<React.SetStateAction<TransactionFormState>>) =>
	(value: T) =>
		setState((prev) => ({ ...prev, [key]: value as TransactionFormState[K] }));

export const useTransactionFormState = (
	accounts: Account[],
	categories: Category[],
	initialTransaction: Transaction | undefined,
	pockets: SavingPocket[],
): TransactionFormState & TransactionFormActions => {
	const [state, setState] = useState<TransactionFormState>(() =>
		initFormState(accounts, categories, initialTransaction),
	);

	useEffect(() => {
		if (!initialTransaction) {
			const acc = accounts.find((a) => a.id === state.accountId);
			if (acc) setState((prev) => ({ ...prev, currency: acc.currency }));
		}
	}, [state.accountId, accounts, initialTransaction]);

	useEffect(() => {
		if (findPocketAccountMismatch(pockets, state.savingPocketId, state.accountId)) {
			setState((prev) => ({ ...prev, savingPocketId: "" }));
		}
	}, [state.accountId, pockets, state.savingPocketId]);

	useEffect(() => {
		if (findPocketAccountMismatch(pockets, state.toSavingPocketId, state.toAccountId)) {
			setState((prev) => ({ ...prev, toSavingPocketId: "" }));
		}
	}, [state.toAccountId, pockets, state.toSavingPocketId]);

	const addBreakdownItem = useCallback(() => {
		setState((prev) => ({
			...prev,
			breakdownItems: [
				...prev.breakdownItems,
				{ id: crypto.randomUUID(), description: "", amount: "" },
			],
		}));
	}, []);

	const removeBreakdownItem = useCallback((id: string) => {
		setState((prev) => ({
			...prev,
			breakdownItems: prev.breakdownItems.filter((i) => i.id !== id),
		}));
	}, []);

	const updateBreakdownItem = useCallback(
		(id: string, field: keyof AmountBreakdownItem, value: any) => {
			setState((prev) => ({
				...prev,
				breakdownItems: prev.breakdownItems.map((item) =>
					item.id === id ? { ...item, [field]: value } : item,
				),
			}));
		},
		[],
	);

	const applySubscription = useCallback((sub: Subscription) => {
		setState((prev) => ({
			...prev,
			categoryId: sub.categoryId,
			amount: formatInitialNumber(sub.amount),
			currency: sub.currency,
			shopName: prev.shopName || sub.name,
		}));
	}, []);

	const resetPotIfAccountChanged = useCallback((nextAccountId: string) => {
		setState((prev) => ({
			...prev,
			accountId: nextAccountId,
			potId: "",
		}));
	}, []);

	const bind = <K extends keyof TransactionFormState>(key: K) =>
		<T>(value: T) => setState((prev) => ({ ...prev, [key]: value as TransactionFormState[K] }));

	return {
		...state,
		setType: bind("type"),
		setAmount: bind("amount"),
		setCurrency: bind("currency"),
		setAccountId: bind("accountId"),
		setPotId: bind("potId"),
		setSavingPocketId: bind("savingPocketId"),
		setToSavingPocketId: bind("toSavingPocketId"),
		setFee: bind("fee"),
		setFeeType: bind("feeType"),
		setSubscriptionId: bind("subscriptionId"),
		setIsSubscription: bind("isSubscription"),
		setFrequency: bind("frequency"),
		setToAccountId: bind("toAccountId"),
		setCategoryId: bind("categoryId"),
		setShopName: bind("shopName"),
		setDate: bind("date"),
		setTime: bind("time"),
		setBreakdownEnabled: bind("breakdownEnabled"),
		setBreakdownItems: bind("breakdownItems"),
		setIsSubsidized: bind("isSubsidized"),
		setMarketValue: bind("marketValue"),
		setIsHistorical: bind("isHistorical"),
		setIsToAccountHistorical: bind("isToAccountHistorical"),
		applySubscription,
		addBreakdownItem,
		removeBreakdownItem,
		updateBreakdownItem,
		resetPotIfAccountChanged,
	};
};
