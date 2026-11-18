import { describe, expect, it } from "vitest";
import { Account, Transaction, TransactionType } from "../types";
import {
	getAccountTransactions,
	getViewedTransferDirection,
	groupTransactions,
	resolveTransferRoute,
} from "../helpers/transactions.helper";

const account = (id: string, name: string): Account => ({
	id,
	name,
	balance: 0,
	currency: "MYR",
	type: "BANK",
	color: "bg-black",
	iconType: "EMOJI",
	iconValue: "🏦",
	userId: "u1",
});

const maybank = account("maybank", "Maybank");
const cimb = account("cimb", "CIMB");
const accounts = [maybank, cimb];

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
	id: "tx-1",
	userId: "u1",
	accountId: "maybank",
	amount: 100,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	shopName: "Transfer",
	date: "2026-11-18",
	createdAt: "2026-11-18T00:00:00.000Z",
	...overrides,
});

describe("resolveTransferRoute", () => {
	it("uses accountId as source and toAccountId as destination for a legacy single-record transfer", () => {
		const route = resolveTransferRoute(
			tx({
				type: TransactionType.TRANSFER,
				accountId: "maybank",
				toAccountId: "cimb",
			}),
			undefined,
			accounts,
		);

		expect(route.sourceId).toBe("maybank");
		expect(route.destinationId).toBe("cimb");
		expect(route.source?.name).toBe("Maybank");
		expect(route.destination?.name).toBe("CIMB");
	});

	it("reverses source and destination for an inbound leg", () => {
		const route = resolveTransferRoute(
			tx({
				type: TransactionType.TRANSFER,
				accountId: "cimb",
				toAccountId: "maybank",
				transferDirection: "IN",
			}),
			undefined,
			accounts,
		);

		expect(route.sourceId).toBe("maybank");
		expect(route.destinationId).toBe("cimb");
	});

	it("keeps the outgoing leg as source when given the inbound record of a linked pair", () => {
		const outLeg = tx({
			id: "out",
			type: TransactionType.TRANSFER,
			accountId: "maybank",
			toAccountId: "cimb",
			transferDirection: "OUT",
			linkedTransactionId: "in",
		});
		const inLeg = tx({
			id: "in",
			type: TransactionType.TRANSFER,
			accountId: "cimb",
			toAccountId: "maybank",
			transferDirection: "IN",
			linkedTransactionId: "out",
		});

		const fromOutLeg = resolveTransferRoute(outLeg, inLeg, accounts);
		expect(fromOutLeg.sourceId).toBe("maybank");
		expect(fromOutLeg.destinationId).toBe("cimb");

		const fromInLeg = resolveTransferRoute(inLeg, outLeg, accounts);
		expect(fromInLeg.sourceId).toBe("maybank");
		expect(fromInLeg.destinationId).toBe("cimb");
	});

	it("degrades to a single endpoint when the destination is a saving pocket", () => {
		const route = resolveTransferRoute(
			tx({
				type: TransactionType.TRANSFER,
				accountId: "maybank",
				toSavingPocketId: "pocket-1",
			}),
			undefined,
			accounts,
		);

		expect(route.sourceId).toBe("maybank");
		expect(route.destinationId).toBeUndefined();
		expect(route.destination).toBeUndefined();
	});

	it("returns an empty route for non-transfer transactions", () => {
		const route = resolveTransferRoute(tx(), undefined, accounts);
		expect(route.source).toBeUndefined();
		expect(route.destination).toBeUndefined();
	});
});

describe("getViewedTransferDirection", () => {
	const route = resolveTransferRoute(
		tx({ type: TransactionType.TRANSFER, accountId: "maybank", toAccountId: "cimb" }),
		undefined,
		accounts,
	);

	it("is OUT when viewing the source account", () => {
		expect(getViewedTransferDirection(route, "maybank")).toBe("OUT");
	});

	it("is IN when viewing the destination account", () => {
		expect(getViewedTransferDirection(route, "cimb")).toBe("IN");
	});

	it("is undefined for an account outside the transfer or no viewer", () => {
		expect(getViewedTransferDirection(route, "other")).toBeUndefined();
		expect(getViewedTransferDirection(route)).toBeUndefined();
	});

	it("derives direction from the viewed account role, not the record's own direction", () => {
		const inboundRecord = tx({
			type: TransactionType.TRANSFER,
			accountId: "cimb",
			toAccountId: "maybank",
			transferDirection: "IN",
		});
		const inboundRoute = resolveTransferRoute(inboundRecord, undefined, accounts);

		expect(getViewedTransferDirection(inboundRoute, "maybank")).toBe("OUT");
	});
});

describe("getAccountTransactions", () => {
	it("returns both legs of a linked transfer involving the viewed account", () => {
		const outLeg = tx({
			id: "out",
			type: TransactionType.TRANSFER,
			accountId: "maybank",
			toAccountId: "cimb",
			transferDirection: "OUT",
			linkedTransactionId: "in",
		});
		const inLeg = tx({
			id: "in",
			type: TransactionType.TRANSFER,
			accountId: "cimb",
			toAccountId: "maybank",
			transferDirection: "IN",
			linkedTransactionId: "out",
		});

		const selected = getAccountTransactions([outLeg, inLeg], "cimb");

		expect(selected.map((t) => t.id).sort()).toEqual(["in", "out"]);
		expect(groupTransactions(selected)).toHaveLength(1);
	});

	it("keeps a legacy single-record transfer to one grouped row for the destination account", () => {
		const legacy = tx({
			type: TransactionType.TRANSFER,
			accountId: "maybank",
			toAccountId: "cimb",
		});

		const selected = getAccountTransactions([legacy], "cimb");
		const grouped = groupTransactions(selected);

		expect(selected).toHaveLength(1);
		expect(grouped).toHaveLength(1);
		expect(resolveTransferRoute(grouped[0], grouped[0].linkedTransaction, accounts)).toMatchObject({
			sourceId: "maybank",
			destinationId: "cimb",
		});
	});

	it("excludes transactions that do not involve the account", () => {
		const unrelated = tx({ id: "unrelated", accountId: "other" });
		const expense = tx({ id: "expense", accountId: "maybank" });

		const selected = getAccountTransactions([unrelated, expense], "maybank");

		expect(selected.map((t) => t.id)).toEqual(["expense"]);
	});
});
