import { Subscription, Transaction, TransactionType } from "../../../types";

export const buildSubscriptionPaymentDraft = (
	sub: Subscription,
	profileId: string | undefined,
): Transaction =>
	({
		id: crypto.randomUUID(),
		userId: profileId || "local",
		accountId: sub.accountId,
		amount: sub.amount,
		currency: sub.currency,
		type: TransactionType.EXPENSE,
		categoryId: sub.categoryId,
		shopName: sub.name,
		date: new Date().toLocaleDateString("en-CA"),
		createdAt: new Date().toISOString(),
		subscriptionId: sub.id,
	}) as Transaction;
