import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TransactionItem from "../components/history/TransactionItem";
import { Account, Category, TransactionType } from "../types";
import { GroupedTransaction } from "../helpers/transactions.helper";

const accounts: Account[] = [
	{
		id: "maybank",
		name: "Maybank",
		balance: 0,
		currency: "MYR",
		type: "BANK",
		color: "bg-yellow-500",
		iconType: "IMAGE",
		iconValue: "https://cdn.example.test/maybank.png",
		userId: "u1",
	},
	{
		id: "cimb",
		name: "CIMB",
		balance: 0,
		currency: "MYR",
		type: "BANK",
		color: "bg-red-500",
		iconType: "EMOJI",
		iconValue: "🔴",
		userId: "u1",
	},
];

const categories: Category[] = [
	{
		id: "cat-food",
		name: "Food",
		icon: "🍜",
		budgetLimit: 0,
		color: "bg-orange-500",
		userId: "u1",
	},
];

const tx = (overrides: Partial<GroupedTransaction> = {}): GroupedTransaction => ({
	id: "tx-1",
	userId: "u1",
	accountId: "maybank",
	amount: 100,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	categoryId: "cat-food",
	shopName: "Lunch",
	date: "2026-11-18",
	createdAt: "2026-11-18T00:00:00.000Z",
	...overrides,
});

const outLeg = (): GroupedTransaction =>
	tx({
		id: "out",
		type: TransactionType.TRANSFER,
		accountId: "maybank",
		toAccountId: "cimb",
		transferDirection: "OUT",
		linkedTransactionId: "in",
		linkedTransaction: tx({
			id: "in",
			type: TransactionType.TRANSFER,
			accountId: "cimb",
			toAccountId: "maybank",
			transferDirection: "IN",
			linkedTransactionId: "out",
		}),
	});

let container: HTMLDivElement;
let root: Root;

const renderItem = (
	transaction: GroupedTransaction,
	overrides: Record<string, unknown> = {},
) => {
	const noop = () => {};
	const props = {
		transaction,
		swipedId: null,
		isSelected: false,
		showSelection: false,
		isBatchMode: false,
		accounts,
		pockets: [],
		categories,
		maskAmount: (amount: number | string) => String(amount),
		maskText: (text: string) => text,
		onSwipeEdit: noop,
		onSwipeDelete: noop,
		onSwipeClose: noop,
		onClick: noop,
		onPointerDown: noop,
		onPointerMove: noop,
		onPointerUp: noop,
		onChevronClick: noop,
		...overrides,
	};

	act(() => {
		root.render(<TransactionItem {...(props as any)} />);
	});

	return container;
};

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.unstubAllGlobals();
});

describe("TransactionItem account metadata", () => {
	it("renders the transaction account name and IMAGE icon after the category", () => {
		renderItem(tx());

		expect(container.textContent).toContain("Food");
		expect(container.textContent).toContain("Maybank");

		const images = Array.from(container.querySelectorAll("img"));
		expect(images.map((img) => img.getAttribute("src"))).toContain(
			"https://cdn.example.test/maybank.png",
		);
	});

	it("renders EMOJI account icons for accounts configured that way", () => {
		renderItem(tx({ accountId: "cimb" }));

		expect(container.textContent).toContain("CIMB");
		expect(container.textContent).toContain("🔴");
	});

	it("masks account names through the provided maskText function", () => {
		renderItem(tx(), {
			maskText: (text: string) => `masked(${text.length})`,
		});

		expect(container.textContent).toContain("masked(7)");
		expect(container.textContent).not.toContain("Maybank");
	});

	it("leaves non-transfer rows without a transfer route arrow", () => {
		renderItem(tx());
		expect(container.textContent).not.toContain("→");
	});
});

describe("TransactionItem transfer presentation", () => {
	it("shows a single source → destination route in the overall history", () => {
		renderItem(outLeg());

		expect(container.textContent).toContain("Maybank");
		expect(container.textContent).toContain("CIMB");
		expect(container.textContent).toContain("→");
		expect(container.textContent).toContain("TRANSFER");
		expect(container.textContent).not.toContain("TRANSFER IN");
		expect(container.textContent).not.toContain("TRANSFER OUT");

		const images = Array.from(container.querySelectorAll("img"));
		expect(images.map((img) => img.getAttribute("src"))).toContain(
			"https://cdn.example.test/maybank.png",
		);
		expect(container.textContent).toContain("🔴");
	});

	it("labels an incoming transfer relative to the viewed account with an incoming icon", () => {
		renderItem(outLeg(), { viewingAccountId: "cimb" });

		expect(container.textContent).toContain("TRANSFER IN");
		expect(container.textContent).not.toContain("TRANSFER OUT");
		expect(container.querySelector('[aria-label="Incoming transfer"]')).not.toBeNull();
		expect(container.textContent).toContain("Maybank");
		expect(container.textContent).toContain("CIMB");
		expect(container.textContent).toContain("→");
	});

	it("labels an outgoing transfer relative to the viewed account with an outgoing icon", () => {
		renderItem(outLeg(), { viewingAccountId: "maybank" });

		expect(container.textContent).toContain("TRANSFER OUT");
		expect(container.textContent).not.toContain("TRANSFER IN");
		expect(container.querySelector('[aria-label="Outgoing transfer"]')).not.toBeNull();
		expect(container.textContent).toContain("Maybank");
		expect(container.textContent).toContain("CIMB");
	});

	it("uses the viewed account role even when the grouped record is the outgoing leg", () => {
		const grouped = outLeg();
		expect(grouped.transferDirection).toBe("OUT");

		renderItem(grouped, { viewingAccountId: "cimb" });

		expect(container.textContent).toContain("TRANSFER IN");
	});
});
