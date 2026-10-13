import { GoogleGenAI } from "@google/genai";
import { ASSET_PROVIDERS, Transaction, TransactionType } from "../types";

/**
 * AI-assisted duplicate detection for bank statement imports.
 *
 * Bank statements list the POSTING date, which often lags the actual
 * transaction date (e.g. a ride-hailing fare is billed days after the
 * trip). The real transaction date is frequently embedded inside the
 * reference number (e.g. "...26092026...", "20260926...", "...260926...")
 * alongside merchant keywords. The AI analyzes these dynamically per
 * statement — no bank-specific date formats are hardcoded.
 *
 * Pipeline (deterministic-first to respect Gemini free-tier quotas):
 *  1. Local prefilter narrows each imported row to possible matches
 *     (same account, matching amount, posting-lag window, ±3d slack for
 *     late record-keeping) with closest-date ordering.
 *  2. Deterministic subset-sum groups (N statement rows = 1 recorded tx,
 *     e.g. a fare billed as 7+1 for a single ride recorded as 8; or 1 row
 *     = N txs, e.g. two reimbursements arriving as one merged credit).
 *     Zero AI cost.
 *  3. Gemini reviews only the remaining ambiguous rows in batches, with a
 *     hard call budget per import.
 *  4. RAG pass for rows still UNIQUE: closest history rows by exact amount
 *     + description keywords (date ignored) -> RELATED, user confirms.
 *  5. Confirmed matches with non-overlapping names are learned as merchant
 *     aliases (localStorage) so future imports pre-map deterministically.
 *  6. On missing key, exhausted budget, or HTTP 429, everything falls back
 *     to conservative heuristics — the import never fails on AI errors.
 */

export interface ParsedStatementItem {
	date: string; // statement posting date (YYYY-MM-DD)
	amount: number;
	type?: string;
	shopName: string;
	note?: string;
	currency?: string;
	reference?: string; // raw reference number / transaction ID
	rawDescription?: string; // full uncleaned description line
}

export interface MatchCandidate {
	importedIndex: number;
	item: ParsedStatementItem;
	existing: {
		id: string;
		shopName: string;
		date: string;
		amount: number;
		type: string;
		note?: string;
		transferDirection?: string;
	}[];
}

export type MatchVerdictType = "DUPLICATE" | "UNIQUE" | "UNCERTAIN" | "RELATED";

export interface MatchVerdict {
	importedIndex: number;
	verdict: MatchVerdictType;
	confidence: number; // 0..1
	matchedTransactionId?: string;
	reason: string;
}

const AMOUNT_TOLERANCE = 0.01;
const POSTING_LAG_DAYS = 14; // bank posting date may lag the real transaction
const APP_DATE_SLACK_DAYS = 3; // user may record a transaction a few days late
const AI_BATCH_SIZE = 40;
const MAX_AI_CALLS = 6; // hard budget per import run (free-tier friendly)
const ALIAS_KEY = "zenfinance_merchant_aliases_v1";
const ALIAS_LIMIT = 200;

const GENERIC_TOKENS = new Set([
	"DUITNOW", "TRANSFER", "FUND", "PAYMENT", "PAYMENTS", "DEBIT", "CREDIT",
	"PURCHASE", "AUTOPAY", "IPAYMENT", "MYDEBIT", "POS", "BANK", "BERHAD",
	"SDN", "BHD", "MALAYSIA", "KUALA", "LUMPUR", "SELANGOR", "PETALING",
	"JAYA", "ACCOUNT", "ONLINE", "DUIT", "QR", "PAY", "WITHDRAWAL",
	"TRANSFER", "CASH", "MONEY", "MAYBANK2U", "CASA", "OFFUS",
]);

const toDayNumber = (dateStr?: string): number => {
	if (!dateStr) return NaN;
	const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
	return isNaN(d.getTime()) ? NaN : Math.floor(d.getTime() / 86400000);
};

const tokenize = (text: string): string[] =>
	(text || "")
		.toUpperCase()
		.replace(/[^A-Z0-9 ]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 3);

const sharesKeyword = (a: string, b: string): boolean => {
	const ta = tokenize(a);
	const tb = tokenize(b);
	return ta.some((x) => tb.some((y) => x === y || x.includes(y) || y.includes(x)));
};

const signedDelta = (
	amount: number,
	type: string,
	transferDirection?: string,
): number =>
	type === "INCOME" || type === "ACCOUNT_OPENING"
		? amount
		: type === "TRANSFER"
			? transferDirection === "IN"
				? amount
				: -amount
			: -amount;

const fmtMoney = (amount: number, currency?: string): string =>
	`${currency ? currency + " " : ""}${amount.toFixed(2)}`;

// ---------------- Merchant alias memory ----------------

interface AliasEntry {
	label: string;
	hits: number;
}

const loadAliases = (): Record<string, AliasEntry> => {
	try {
		return JSON.parse(localStorage.getItem(ALIAS_KEY) || "{}");
	} catch {
		return {};
	}
};

const saveAliases = (aliases: Record<string, AliasEntry>) => {
	try {
		localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases));
	} catch {
		/* storage full/unavailable — aliases are best-effort */
	}
};

const aliasTokens = (item: ParsedStatementItem): string[] =>
	tokenize(`${item.rawDescription || ""} ${item.reference || ""} ${item.shopName || ""}`)
		.filter((t) => !/^\d+$/.test(t) && !GENERIC_TOKENS.has(t))
		.slice(0, 3);

const aliasKeyFor = (item: ParsedStatementItem): string | null => {
	const tokens = aliasTokens(item);
	return tokens.length > 0 ? tokens.join(" ") : null;
};

/**
 * If a learned alias matches this statement row's merchant tokens, return
 * the user's own label so it can keyword-match their transaction history.
 */
const aliasLabelFor = (item: ParsedStatementItem): string => {
	const aliases = loadAliases();
	const tokens = aliasTokens(item);
	if (tokens.length === 0) return "";
	for (const [key, entry] of Object.entries(aliases)) {
		const keyTokens = key.split(" ");
		const matched = keyTokens.filter((kt) =>
			tokens.some((t) => t === kt || t.includes(kt) || kt.includes(t)),
		).length;
		if (matched >= Math.max(1, keyTokens.length - 1)) return entry.label;
	}
	return "";
};

const effectiveItemText = (item: ParsedStatementItem): string =>
	`${item.rawDescription || ""} ${item.reference || ""} ${item.shopName || ""} ${aliasLabelFor(item)}`;

// Provider brand tokens derived from the app's own provider registry, so
// the alias learner never treats a financial institution as a merchant.
const PROVIDER_TOKENS = new Set<string>(["WISE", "PAYPAL", "REVOLUT"]);
ASSET_PROVIDERS.forEach((p) => {
	PROVIDER_TOKENS.add(String(p.id).toUpperCase());
	String(p.name)
		.toUpperCase()
		.replace(/[^A-Z0-9 ]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 3)
		.forEach((t) => PROVIDER_TOKENS.add(t));
});

const learnAliasesFromVerdicts = (
	imported: ParsedStatementItem[],
	verdicts: MatchVerdict[],
	txsById: Map<string, Transaction>,
) => {
	const aliases = loadAliases();
	let dirty = false;
	verdicts.forEach((v) => {
		if (v.verdict !== "DUPLICATE" || !v.matchedTransactionId) return;
		const item = imported[v.importedIndex];
		const tx = txsById.get(v.matchedTransactionId);
		if (!item || !tx) return;
		if (
			item.type === "INCOME" !== (tx.type === "INCOME" || tx.type === "ACCOUNT_OPENING")
		)
			return; // never learn across opposite money directions
		if (!tx.shopName || !tx.shopName.trim()) return; // nothing to learn
		const key = aliasKeyFor(item);
		if (!key) return;
		const keyTokens = key.split(" ");
		if (
			keyTokens.length === 1 &&
			(PROVIDER_TOKENS.has(keyTokens[0]) || keyTokens[0].length < 5)
		)
			return; // too generic to be a safe alias key
		if (sharesKeyword(key, tx.shopName)) return; // already keyword-aligned
		const existing = aliases[key];
		if (existing) {
			if (existing.label !== tx.shopName) return; // conflicting signal, skip
			existing.hits += 1;
		} else {
			if (Object.keys(aliases).length >= ALIAS_LIMIT) return;
			aliases[key] = { label: tx.shopName, hits: 1 };
		}
		dirty = true;
	});
	if (dirty) saveAliases(aliases);
};

// ---------------- Stage 1: local prefilter ----------------

/**
 * Step 1 — cheap local narrowing. Finds plausible existing matches per
 * imported row so the AI prompt stays small and offline users get a fallback.
 * Candidates are ordered closest-date-first so identical-amount rows
 * (e.g. repeated identical small purchases) align deterministically.
 */
export const buildMatchCandidates = (
	imported: ParsedStatementItem[],
	existingTransactions: Transaction[],
	accountId: string,
): MatchCandidate[] => {
	const relevant = existingTransactions.filter(
		(t) =>
			t.accountId === accountId &&
			t.type !== TransactionType.ADJUSTMENT &&
			t.type !== TransactionType.ACCOUNT_DELETE &&
			t.type !== TransactionType.ACCOUNT_OPENING,
	);

	return imported.map((item, importedIndex) => {
		const statementDay = toDayNumber(item.date);

		// Sign-aware: a bank CREDIT must never candidate-match an app EXPENSE
		// (and vice versa). Unknown item type falls back to unsigned compare.
		const itemDelta =
			item.type === "INCOME"
				? item.amount
				: item.type === "EXPENSE"
					? -item.amount
					: null;

		const existing = relevant
			.map((t) => {
				const txDelta = signedDelta(t.amount, t.type, t.transferDirection);
				if (itemDelta === null) {
					if (Math.abs(t.amount - item.amount) > AMOUNT_TOLERANCE) return null;
				} else if (Math.abs(txDelta - itemDelta) > AMOUNT_TOLERANCE) {
					return null;
				}
				const txDay = toDayNumber(t.date);
				if (isNaN(statementDay) || isNaN(txDay)) return { t, proximity: 999 };
				const lag = statementDay - txDay;
				if (lag < -APP_DATE_SLACK_DAYS || lag > POSTING_LAG_DAYS) return null;
				return { t, proximity: Math.abs(lag) };
			})
			.filter((x): x is { t: Transaction; proximity: number } => x !== null)
			.sort((a, b) => a.proximity - b.proximity)
			.map(({ t }) => ({
				id: t.id,
				shopName: t.shopName,
				date: t.date,
				amount: t.amount,
				type: t.type,
				note: t.note,
				transferDirection: t.transferDirection,
			}));

		return { importedIndex, item, existing };
	});
};

// ---------------- Heuristic fallbacks ----------------

/**
 * Conservative, no AI needed. Closest-date candidate wins amount ties.
 * Sequentially consumes matched ids so identical-amount rows (a swarm of
 * identical recurring charges) align one-to-one instead of all
 * pointing at the same transaction.
 */
export const heuristicVerdicts = (
	candidates: MatchCandidate[],
	preConsumed?: Set<string>,
): MatchVerdict[] => {
	const consumed = new Set(preConsumed || []);
	return candidates.map(({ importedIndex, item, existing }) => {
		const statementDay = toDayNumber(item.date);
		const itemDelta =
			item.type === "INCOME"
				? item.amount
				: item.type === "EXPENSE"
					? -item.amount
					: null;
		const signOk = (e: {
			amount: number;
			type: string;
			transferDirection?: string;
		}) =>
			itemDelta === null ||
			Math.abs(signedDelta(e.amount, e.type, e.transferDirection) - itemDelta) <=
				AMOUNT_TOLERANCE;

		const avail = existing.filter((e) => !consumed.has(e.id));

		const sameDay = avail
			.filter(
				(e) =>
					signOk(e) &&
					Math.abs(toDayNumber(e.date) - statementDay) === 0,
			)
			.sort((a, b) => Math.abs(a.amount - item.amount) - Math.abs(b.amount - item.amount))[0];
		if (sameDay) {
			consumed.add(sameDay.id);
			return {
				importedIndex,
				verdict: "DUPLICATE",
				confidence: 0.95,
				matchedTransactionId: sameDay.id,
				reason: `Same amount and same date as an existing transaction (${sameDay.shopName}).`,
			};
		}

		const keywordHits = avail
			.filter(
				(e) =>
					signOk(e) &&
					(sharesKeyword(item.shopName, e.shopName) ||
						sharesKeyword(item.rawDescription || item.shopName, e.shopName)),
			)
			.sort(
				(a, b) =>
					Math.abs(toDayNumber(a.date) - statementDay) -
					Math.abs(toDayNumber(b.date) - statementDay),
			);
		const keywordHit = keywordHits[0];
		if (keywordHit) {
			consumed.add(keywordHit.id);
			return {
				importedIndex,
				verdict: "UNCERTAIN",
				confidence: 0.6,
				matchedTransactionId: keywordHit.id,
				reason: `Same amount and merchant keyword "${keywordHit.shopName}" within the posting-lag window — review manually.`,
			};
		}

		return {
			importedIndex,
			verdict: "UNIQUE",
			confidence: 0.7,
			reason:
				avail.length > 0
					? "Exact amount found nearby but no keyword/date confirmation — treated as new; review if unexpected."
					: "No existing transaction matches this amount in the date window.",
		};
	});
};
/**
 * Stage-2 fallback — keyword + exact amount retrieval, low confidence,
 * always surfaced to the user for confirmation (never auto-decided).
 */
const heuristicRelatedVerdicts = (
	related: MatchCandidate[],
	preConsumed?: Set<string>,
): MatchVerdict[] => {
	const consumed = new Set(preConsumed || []);
	return related.map(({ importedIndex, item, existing }) => {
		const best = existing.find(
			(e) =>
				!consumed.has(e.id) &&
				Math.abs(e.amount - item.amount) <= AMOUNT_TOLERANCE &&
				(sharesKeyword(item.rawDescription || item.shopName, e.shopName) ||
					sharesKeyword(item.reference || "", e.shopName) ||
					sharesKeyword(item.shopName, e.shopName)),
		);
		if (best) {
			consumed.add(best.id);
			return {
				importedIndex,
				verdict: "RELATED",
				confidence: 0.55,
				matchedTransactionId: best.id,
				reason: `Closest history match: "${best.shopName}" on ${best.date} — same amount with matching keywords. Confirm if this is the same transaction.`,
			};
		}
		return {
			importedIndex,
			verdict: "UNIQUE",
			confidence: 0.7,
			reason: "No related transaction found in your history.",
		};
	});
};

// ---------------- Deterministic subset-sum grouping (zero AI cost) ----------------

/**
 * Step 2 — resolves split billing and merged payments without AI:
 *   Direction A: several statement rows sum to ONE recorded transaction
 *     (a fare billed as two rows for one recorded ride; refunds arrive as
 *     two credits 10.81 + 1.08 for one recorded 11.89 refund).
 *   Direction B: one statement row equals the SUM of several recorded
 *     transactions (two AA incomes arriving as one merged credit).
 * Only touches rows with no strict 1-1 candidate, so it never competes
 * with stage 3. Subset size is capped to keep this O(small).
 */
const matchSplitGroups = (
	imported: ParsedStatementItem[],
	zeroCandidateIndexes: number[],
	accountTransactions: Transaction[],
	consumedExistingIds: Set<string>,
): { verdicts: MatchVerdict[]; consumedExisting: Set<string> } => {
	const verdicts: MatchVerdict[] = [];
	const consumedExisting = new Set(consumedExistingIds);
	const usedImported = new Set<number>();

	const pool = accountTransactions.filter(
		(t) =>
			!consumedExisting.has(t.id) &&
			(t.type === "EXPENSE" || t.type === "INCOME"),
	);

	// Direction A: N imported rows -> 1 existing tx.
	// Group key uses the merchant CLASS (first significant token) so
	// descriptor variants of the same merchant still group together.
	const merchantClassOf = (item: ParsedStatementItem): string => {
		const tokens = tokenize(item.shopName || "");
		return tokens[0] || (item.shopName || "").toUpperCase().slice(0, 6) || "UNKNOWN";
	};
	const byKey = new Map<string, number[]>();
	zeroCandidateIndexes.forEach((idx) => {
		const item = imported[idx];
		if (!item || item.type === "TRANSFER") return;
		const key = `${merchantClassOf(item)}|${item.type || ""}`;
		if (!byKey.has(key)) byKey.set(key, []);
		byKey.get(key)!.push(idx);
	});
	byKey.forEach((indexes) => {
		if (indexes.length < 2 || indexes.length > 4) return;
		const sorted = indexes.sort(
			(a, b) => toDayNumber(imported[a].date) - toDayNumber(imported[b].date),
		);
		// Multiple disjoint splits can exist for one merchant class
		// (two different purchases from the same merchant, each billed as
		// multiple rows), so keep scanning until no more groups resolve.
		let progress = true;
		while (progress) {
			progress = false;
			for (let size = 2; size <= Math.min(4, sorted.length); size++) {
				const avail = sorted.filter((g) => !usedImported.has(g));
				if (avail.length < size) continue;
				let matchedThisSize = false;
				for (let start = 0; start + size <= avail.length; start++) {
					const group = avail.slice(start, start + size);
					const days = group.map((g) => toDayNumber(imported[g].date));
					if (Math.max(...days) - Math.min(...days) > 5) continue;
					const sum = group.reduce((s, g) => s + imported[g].amount, 0);
					const type = imported[group[0]].type || "EXPENSE";
					const target = pool.find(
						(t) =>
							!consumedExisting.has(t.id) &&
							t.type === type &&
							Math.abs(t.amount - sum) <= AMOUNT_TOLERANCE &&
							(() => {
								const targetDay = toDayNumber(t.date);
								const lag = Math.min(...days) - targetDay;
								return (
									!isNaN(targetDay) &&
									lag >= -APP_DATE_SLACK_DAYS &&
									lag <= POSTING_LAG_DAYS + 5
								);
							})(),
					);
					if (!target) continue;
					group.forEach((g) => {
						verdicts.push({
							importedIndex: g,
							verdict: "DUPLICATE",
							confidence: 0.85,
							matchedTransactionId: target.id,
							reason: `Split billing: ${group
								.map(
									(x) =>
										fmtMoney(imported[x].amount, imported[x].currency || target.currency),
								)
								.join(" + ")} in the statement together match your ${fmtMoney(
								target.amount,
								target.currency,
							)} "${target.shopName}" recorded on ${String(target.date).slice(0, 10)}.`,
						});
						usedImported.add(g);
					});
					consumedExisting.add(target.id);
					matchedThisSize = true;
					progress = true;
					break;
				}
				if (matchedThisSize) break;
			}
		}
	});

	// Direction B: 1 imported row -> N existing txs
	zeroCandidateIndexes.forEach((idx) => {
		if (usedImported.has(idx)) return;
		const item = imported[idx];
		if (item.type === "TRANSFER") return;
		const itemDay = toDayNumber(item.date);
		const sameSign = pool.filter(
			(t) => !consumedExisting.has(t.id) && (item.type === "INCOME" ? t.type === "INCOME" : t.type === "EXPENSE"),
		).filter((t) => {
			const day = toDayNumber(t.date);
			const lag = itemDay - day;
			return (
				!isNaN(day) &&
				lag >= -APP_DATE_SLACK_DAYS &&
				lag <= POSTING_LAG_DAYS
			);
		});
		const byAmountCents = new Map<number, { tx: Transaction; index: number }[]>();
		sameSign.forEach((tx, index) => {
			const key = Math.round(tx.amount * 100);
			const entries = byAmountCents.get(key) || [];
			entries.push({ tx, index });
			byAmountCents.set(key, entries);
		});
		for (let i = 0; i < sameSign.length; i++) {
			const a = sameSign[i];
			const aDay = toDayNumber(a.date);
			const targetCents = Math.round((item.amount - a.amount) * 100);
			const candidates = [-1, 0, 1].flatMap(
				(offset) => byAmountCents.get(targetCents + offset) || [],
			);
			for (const { tx: b, index: j } of candidates) {
				if (j <= i || consumedExisting.has(b.id)) continue;
				const bDay = toDayNumber(b.date);
				if (Math.abs(aDay - bDay) > 2) continue;
				if (Math.abs(a.amount + b.amount - item.amount) > AMOUNT_TOLERANCE) continue;
				const kw = sharesKeyword(
					effectiveItemText(item),
					`${a.shopName} ${b.shopName}`,
				);
				// Without keyword support, only same-day pairs are trustworthy
				// (repetitive identical small amounts sum to coincidences)
				if (!kw && aDay !== bDay) continue;
				verdicts.push({
					importedIndex: idx,
					verdict: kw ? "DUPLICATE" : "RELATED",
					confidence: kw ? 0.85 : 0.6,
					matchedTransactionId: a.id,
					reason: `Merged payment: this statement row (${fmtMoney(
						item.amount,
						item.currency,
					)}) matches two recorded transactions together — "${a.shopName}" ${fmtMoney(
						a.amount,
						a.currency,
					)} + "${b.shopName}" ${fmtMoney(b.amount, b.currency)}. Confirm if these are the same money movement.`,
				});
				usedImported.add(idx);
				consumedExisting.add(a.id);
				consumedExisting.add(b.id);
				return;
			}
		}
	});

	return { verdicts, consumedExisting };
};

// ---------------- AI stages (budgeted) ----------------

class QuotaError extends Error {}

const callGeminiJSON = async (apiKey: string, prompt: string): Promise<any[]> => {
	const ai = new GoogleGenAI({ apiKey });
	try {
		const response = await ai.models.generateContent({
			model: "gemini-3.1-flash-lite",
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			config: { responseMimeType: "application/json" },
		});
		const text = response.text || "";
		const cleaned = text
			.trim()
			.replace(/^```(?:json)?/i, "")
			.replace(/```$/, "")
			.trim();
		const parsed = JSON.parse(cleaned);
		return Array.isArray(parsed) ? parsed : parsed.verdicts || parsed.results || [];
	} catch (err: any) {
		const msg = String(err?.message || "");
		if (
			err?.status === 429 ||
			msg.includes("429") ||
			msg.toLowerCase().includes("quota") ||
			msg.toLowerCase().includes("resource_exhausted")
		) {
			throw new QuotaError();
		}
		throw err;
	}
};

const parseVerdictRows = (
	rows: any[],
	validIndexes: Set<number>,
	validIdsByIndex?: Map<number, Set<string>>,
	alreadyConsumedIds?: Set<string>,
): MatchVerdict[] => {
	const verdicts: MatchVerdict[] = [];
	const acceptedIds = new Set(alreadyConsumedIds || []);
	rows.forEach((r) => {
		if (typeof r?.importedIndex !== "number" || !validIndexes.has(r.importedIndex))
			return;
		const verdictType: MatchVerdictType = [
			"DUPLICATE",
			"UNIQUE",
			"UNCERTAIN",
			"RELATED",
		].includes(r.verdict)
			? r.verdict
			: "UNCERTAIN";
		const proposedId =
			(r.verdict === "DUPLICATE" || r.verdict === "RELATED") &&
			r.matchedTransactionId
				? String(r.matchedTransactionId)
				: undefined;
		if (
			proposedId &&
			(!validIdsByIndex?.get(r.importedIndex)?.has(proposedId) ||
				acceptedIds.has(proposedId))
		)
			return;
		if (proposedId) acceptedIds.add(proposedId);
		verdicts.push({
			importedIndex: r.importedIndex,
			verdict: verdictType,
			confidence:
				typeof r.confidence === "number"
					? Math.min(1, Math.max(0, r.confidence))
					: 0.5,
			matchedTransactionId: proposedId,
			reason: String(r.reason || "").slice(0, 300),
		});
	});
	return verdicts;
};

/**
 * Step 3 — Gemini analyzes reference numbers/descriptions for embedded
 * transaction dates and merchant keywords, then rules on each candidate.
 * Budget-aware: stops issuing calls once the per-import budget is spent.
 */
export const matchImportedWithAI = async (
	apiKey: string,
	candidates: MatchCandidate[],
	budget: { calls: number },
	consumedExistingIds?: Set<string>,
): Promise<MatchVerdict[]> => {
	const consumed = new Set(consumedExistingIds || []);
	const needsAI = candidates.filter((c) => c.existing.length > 0);
	const autoUnique = candidates
		.filter((c) => c.existing.length === 0)
		.map<MatchVerdict>((c) => ({
			importedIndex: c.importedIndex,
			verdict: "UNIQUE",
			confidence: 0.8,
			reason: "No transaction with this amount exists around the statement date.",
		}));

	if (needsAI.length === 0) return autoUnique;

	const finalKey = (apiKey || "").trim();
	if (!finalKey) return [...autoUnique, ...heuristicVerdicts(candidates, consumed)];

	const verdicts: MatchVerdict[] = [];

	for (let i = 0; i < needsAI.length && budget.calls > 0; i += AI_BATCH_SIZE) {
		const batch = needsAI.slice(i, i + AI_BATCH_SIZE);
		budget.calls -= 1;

		const blocks = batch
			.map((c) => {
				const candidateLines = c.existing
					.map(
						(e, j) =>
							`    [${j}] id=${e.id} | date=${e.date} | amount=${e.amount} | shop="${e.shopName}"${e.note ? ` | note="${e.note}"` : ""}`,
					)
					.join("\n");
				return [
					`IMPORTED #${c.importedIndex}:`,
					`  statementDate: ${c.item.date}`,
					`  amount: ${c.item.amount} ${c.item.currency || ""} ${c.item.type || ""}`,
					`  shop: "${c.item.shopName}"`,
					`  reference: "${c.item.reference || ""}"`,
					`  rawDescription: "${c.item.rawDescription || c.item.note || ""}"`,
					`  possible existing matches (closest date first):`,
					candidateLines || "    (none)",
				].join("\n");
			})
			.join("\n\n");

		const prompt = `
You are a bank statement deduplication engine for a personal finance app.

The user manually tracks transactions in the app. A bank statement is being imported. Statements show the POSTING date, which can lag the ACTUAL transaction date by hours or days (POS/e-wallet charges are commonly billed 1-7 days after the underlying purchase). The actual date is often embedded inside the reference number or description in formats such as DDMMYYYY, YYYYMMDD, DDMMYY, YYMMDD, MMDD or similar — the format varies per bank, so infer it from context for EACH row instead of assuming one format. The user may also have recorded a transaction 1-3 days AFTER it happened, so a candidate dated slightly before the embedded date can still be the match.

For every IMPORTED row below, compare it against its possible existing matches and decide:
- DUPLICATE: the same real-world purchase. Strong signals: amount matches exactly, AND (an embedded date in the reference matches a candidate's date, OR merchant keywords in the reference/rawDescription match the candidate's shop, OR the statement date itself matches).
- UNIQUE: no plausible match exists (all candidates differ in amount context, merchant, or every plausible embedded date).
- UNCERTAIN: some signals match but you cannot be sure.

Rules:
1. Try to extract an embedded transaction date from the reference/rawDescription FIRST, then use it as the primary comparison date against each candidate.
2. Merchant keywords (brand names like ride-hailing, streaming or e-commerce services) outweigh generic words. Reference numbers with matching embedded dates + same amount + same merchant = near certain DUPLICATE.
3. TIE-BREAKING: when several candidates have the exact same amount, prefer the one with the smallest date difference from the embedded/statement date, and say so in the reason.
4. If two different candidates both look plausible, pick the one with the strongest combined signal and mark UNCERTAIN.
5. confidence: 0-1. DUPLICATE >= 0.85 typically. UNCERTAIN 0.4-0.7. UNIQUE >= 0.7 when no candidate is plausible.
6. reason: one short user-facing sentence explaining the decision (mention the embedded date or keyword that decided it).
7. Respond ONLY with JSON: an array of {"importedIndex": number, "verdict": "DUPLICATE"|"UNIQUE"|"UNCERTAIN", "confidence": number, "matchedTransactionId": string|null, "reason": string}. Include every IMPORTED row, using matchedTransactionId=null for UNIQUE.

DATA:
${blocks}
`;

		try {
			const rows = await callGeminiJSON(finalKey, prompt);
			const parsed = parseVerdictRows(
				rows,
				new Set(batch.map((c) => c.importedIndex)),
				new Map(
					batch.map((c) => [
						c.importedIndex,
						new Set(c.existing.map((e) => e.id)),
					]),
				),
				consumed,
			);
			parsed.forEach((v) => {
				if (v.matchedTransactionId) consumed.add(v.matchedTransactionId);
			});
			verdicts.push(...parsed);
		} catch (err) {
			if (err instanceof QuotaError) throw err;
			console.error("Import matching AI batch error:", err);
		}
	}

	// Fill any rows the model skipped or budget cut off
	const missing = needsAI.filter(
		(c) => !verdicts.some((v) => v.importedIndex === c.importedIndex),
	);
	if (missing.length > 0) {
		verdicts.push(
			...heuristicVerdicts(missing, consumed).map((v) => ({
				...v,
				reason:
					v.reason +
					(budget.calls > 0 ? "" : " (AI budget reached — heuristic match, please confirm)"),
			})),
		);
	}

	return [...autoUnique, ...verdicts];
};

/**
 * Step 4 (RAG) — the AI reviews retrieved history rows (closest description +
 * exact amount) against the statement reference to propose related
 * transactions the strict pass missed (late postings, fee/FX variance).
 */
export const matchRelatedWithAI = async (
	apiKey: string,
	related: MatchCandidate[],
	budget: { calls: number },
	consumedExistingIds?: Set<string>,
): Promise<MatchVerdict[]> => {
	const consumed = new Set(consumedExistingIds || []);
	const finalKey = (apiKey || "").trim();
	if (!finalKey || related.length === 0) {
		return heuristicRelatedVerdicts(related, consumed);
	}

	const verdicts: MatchVerdict[] = [];

	for (let i = 0; i < related.length && budget.calls > 0; i += AI_BATCH_SIZE) {
		const batch = related.slice(i, i + AI_BATCH_SIZE);
		budget.calls -= 1;

		const blocks = batch
			.map((c) => {
				const candidateLines = c.existing
					.map(
						(e, j) =>
							`    [${j}] id=${e.id} | date=${e.date} | amount=${e.amount} | shop="${e.shopName}"${e.note ? ` | note="${e.note}"` : ""}`,
					)
					.join("\n");
				return [
					`IMPORTED #${c.importedIndex}:`,
					`  statementDate: ${c.item.date}`,
					`  amount: ${c.item.amount} ${c.item.currency || ""} ${c.item.type || ""}`,
					`  shop: "${c.item.shopName}"`,
					`  reference: "${c.item.reference || ""}"`,
					`  rawDescription: "${c.item.rawDescription || c.item.note || ""}"`,
					`  closest history rows (retrieved by amount + description keywords, date window IGNORED):`,
					candidateLines || "    (none)",
				].join("\n");
			})
			.join("\n\n");

		const prompt = `
You are a bank statement reconciliation engine for a personal finance app.

These imported statement rows had NO strict duplicate match (no candidate with same amount inside the usual posting-lag window). For each one, the closest transactions from the user's own history were retrieved by exact amount and description keyword similarity — the date window was deliberately IGNORED, because some billers post weeks or months after the purchase (annual renewals, FX settlement, pending-then-captured charges).

Your job: review the imported reference/rawDescription against each retrieved history row's shop name and note, and decide whether this is the SAME real-world transaction recorded earlier by the user.

Analyze:
1. Extract any embedded date from the reference/rawDescription (any format: DDMMYYYY, YYYYMMDD, DDMMYY, YYMMDD, MMDD — infer per row from context). An embedded date matching the history row's date is the strongest link signal.
2. Merchant keywords (recognizable brand names shared between the reference/rawDescription and the history description).
3. Amount: exact match expected; small variance (fees, FX rounding) still acceptable.
4. Recurring same-amount charges (subscriptions) with different embedded dates or months apart are NOT the same transaction — mark UNIQUE.

Verdicts:
- RELATED: same real-world transaction, posted late or with slight amount variance. Propose linking to the strongest candidate via matchedTransactionId.
- UNIQUE: nothing in the retrieved history corresponds to this row.

Rules:
- TIE-BREAKING: when several retrieved rows share the same amount, prefer the smallest date difference and explain it in the reason.
- confidence: 0-1. RELATED >= 0.6. If you are not clearly sure, prefer UNIQUE over a wrong link — the user will confirm RELATED rows anyway.
- reason: one short user-facing sentence posing the question naturally, e.g. "Ref contains an embedded date matching your existing transaction from that day — same transaction?" Mention the deciding signal (embedded date or keyword).
- Respond ONLY with JSON: an array of {"importedIndex": number, "verdict": "RELATED"|"UNIQUE", "confidence": number, "matchedTransactionId": string|null, "reason": string}. Include every IMPORTED row (matchedTransactionId=null for UNIQUE).

DATA:
${blocks}
`;

		try {
			const rows = await callGeminiJSON(finalKey, prompt);
			const parsed = parseVerdictRows(
				rows,
				new Set(batch.map((c) => c.importedIndex)),
				new Map(
					batch.map((c) => [
						c.importedIndex,
						new Set(c.existing.map((e) => e.id)),
					]),
				),
				consumed,
			);
			parsed.forEach((v) => {
				if (v.matchedTransactionId) consumed.add(v.matchedTransactionId);
			});
			verdicts.push(...parsed);
		} catch (err) {
			if (err instanceof QuotaError) throw err;
			console.error("Related matching AI batch error:", err);
		}
	}

	const missing = related.filter(
		(c) => !verdicts.some((v) => v.importedIndex === c.importedIndex),
	);
	if (missing.length > 0)
		verdicts.push(...heuristicRelatedVerdicts(missing, consumed));

	return verdicts;
};

// ---------------- Pipeline ----------------

/**
 * Full pipeline — deterministic-first, AI only where genuinely ambiguous,
 * with a hard per-import call budget so free-tier quotas are respected.
 */
export const runImportMatching = async (
	apiKey: string,
	imported: ParsedStatementItem[],
	existingTransactions: Transaction[],
	accountId: string,
): Promise<Map<number, MatchVerdict>> => {
	const candidates = buildMatchCandidates(
		imported,
		existingTransactions,
		accountId,
	);
	const txsById = new Map(existingTransactions.map((t) => [t.id, t]));
	const budget = { calls: MAX_AI_CALLS };

	const verdictMap = new Map<number, MatchVerdict>();
	const consumedExistingIds = new Set<string>();
	const accept = (verdicts: MatchVerdict[]) => {
		// Split groups intentionally point several rows at ONE target, so a
		// target consumed earlier IN THIS BATCH must not block its group-mates.
		const batchIds = new Set(
			verdicts
				.map((v) => v.matchedTransactionId)
				.filter((id): id is string => Boolean(id)),
		);
		verdicts.forEach((v) => {
			if (verdictMap.has(v.importedIndex)) return;
			if (
				v.matchedTransactionId &&
				consumedExistingIds.has(v.matchedTransactionId) &&
				!batchIds.has(v.matchedTransactionId)
			)
				return;
			verdictMap.set(v.importedIndex, v);
		});
		batchIds.forEach((id) => consumedExistingIds.add(id));
	};

	// Stage 2: deterministic split/merged groups first (free)
	const zeroCandidateIndexes = candidates
		.filter((c) => c.existing.length === 0)
		.map((c) => c.importedIndex);
	const accountTransactions = existingTransactions.filter(
		(t) =>
			t.accountId === accountId &&
			t.type !== TransactionType.ADJUSTMENT &&
			t.type !== TransactionType.ACCOUNT_DELETE &&
			t.type !== TransactionType.ACCOUNT_OPENING,
	);
	try {
		const { verdicts, consumedExisting } = matchSplitGroups(
			imported,
			zeroCandidateIndexes,
			accountTransactions,
			consumedExistingIds,
		);
		accept(verdicts);
		consumedExistingIds.clear();
		consumedExisting.forEach((id) => consumedExistingIds.add(id));
	} catch (err) {
		console.error("Split-group matching error:", err);
	}

	// Stage 3: AI on remaining rows that have strict candidates.
	// Candidates already consumed by earlier stages are excluded so neither
	// the heuristics nor the AI propose double-links.
	const openCandidates = candidates
		.filter((c) => !verdictMap.has(c.importedIndex))
		.map((c) => ({
			...c,
			existing: c.existing.filter((e) => !consumedExistingIds.has(e.id)),
		}));
	let stage1verdicts: MatchVerdict[];
	try {
		stage1verdicts = await matchImportedWithAI(
			apiKey,
			openCandidates,
			budget,
			consumedExistingIds,
		);
	} catch (err) {
		if (err instanceof QuotaError) {
			console.warn("Gemini quota reached — falling back to heuristics.");
			stage1verdicts = heuristicVerdicts(
				openCandidates,
				consumedExistingIds,
			).map((v) => ({
				...v,
				reason: v.reason + " (AI quota reached — heuristic match, please confirm)",
			}));
			budget.calls = 0;
		} else {
			console.error("Import matching AI error, using heuristics:", err);
			stage1verdicts = heuristicVerdicts(openCandidates, consumedExistingIds);
		}
	}
	accept(stage1verdicts);

	// Stage 4: RAG pass for rows still UNIQUE
	const uniqueIndexes = new Set(
		[...verdictMap.values()]
			.filter((v) => v.verdict === "UNIQUE")
			.map((v) => v.importedIndex),
	);

	if (uniqueIndexes.size > 0) {
		const related: MatchCandidate[] = Array.from(uniqueIndexes)
			.map((importedIndex) => ({
				importedIndex,
				item: imported[importedIndex],
				existing: retrieveRelated(
					imported[importedIndex],
					accountTransactions,
					consumedExistingIds,
				),
			}))
			.filter((c) => c.existing.length > 0);

		if (related.length > 0) {
			let relatedVerdicts: MatchVerdict[];
			try {
				relatedVerdicts = await matchRelatedWithAI(
					apiKey,
					related,
					budget,
					consumedExistingIds,
				);
			} catch (err) {
				if (err instanceof QuotaError) {
					console.warn("Gemini quota reached — heuristics for related pass.");
					relatedVerdicts = heuristicRelatedVerdicts(
						related,
						consumedExistingIds,
					);
				} else {
					console.error("Related matching AI error, using heuristics:", err);
					relatedVerdicts = heuristicRelatedVerdicts(
						related,
						consumedExistingIds,
					);
				}
			}
			accept(
				relatedVerdicts.filter(
					(v) => v.verdict === "RELATED" && !verdictMap.has(v.importedIndex),
				),
			);
		}
	}

	// Fill anything still uncovered (shouldn't happen, but never leave holes)
	const stillMissing = imported
		.map((_, idx) => idx)
		.filter((idx) => !verdictMap.has(idx));
	if (stillMissing.length > 0) {
		accept(
			heuristicVerdicts(
				stillMissing.map((idx) => ({
					importedIndex: idx,
					item: imported[idx],
					existing: (candidates.find((c) => c.importedIndex === idx)?.existing || []).filter(
						(e) => !consumedExistingIds.has(e.id),
					),
				})),
				consumedExistingIds,
			),
		);
	}

	learnAliasesFromVerdicts(imported, [...verdictMap.values()], txsById);

	return verdictMap;
};

/**
 * RAG retrieval — for rows with no strict match, pull the closest history
 * rows by exact amount + description/reference keywords. Date is only a
 * soft signal here (late postings are the whole point of this stage).
 */
const keywordOverlapCount = (a: string, b: string): number => {
	const ta = tokenize(a);
	const tb = tokenize(b);
	return tb.filter((x) =>
		ta.some((y) => x === y || x.includes(y) || y.includes(x)),
	).length;
};

const RELATED_TOP_K = 5;
const RELATED_MIN_SCORE = 3;

const retrieveRelated = (
	item: ParsedStatementItem,
	accountTransactions: Transaction[],
	excludedIds: Set<string>,
): {
	id: string;
	shopName: string;
	date: string;
	amount: number;
	type: string;
	note?: string;
}[] => {
	const importedText = effectiveItemText(item);

	const scored = accountTransactions
		.filter((t) => {
			if (excludedIds.has(t.id)) return false;
			if (item.type === "INCOME")
				return t.type === "INCOME" || t.type === "ACCOUNT_OPENING";
			if (item.type === "EXPENSE") return signedDelta(t.amount, t.type, t.transferDirection) < 0;
			return true;
		})
		.map((t) => {
			let score = 0;

			// Exact amount is the strongest retrieval signal
			const amountDiff = Math.abs(t.amount - item.amount);
			if (amountDiff <= AMOUNT_TOLERANCE) score += 5;
			else if (amountDiff <= Math.max(0.5, item.amount * 0.05)) score += 2;

			// Description/reference keyword overlap vs history description
			const historyText = [t.shopName, t.note].filter(Boolean).join(" ");
			score += Math.min(4, keywordOverlapCount(importedText, historyText) * 2);

			// Date proximity is only a soft signal here — the whole point of
			// this stage is that posting can lag far behind the real date
			const dayDiff = toDayNumber(item.date) - toDayNumber(t.date);
			if (!isNaN(dayDiff)) {
				if (dayDiff >= -APP_DATE_SLACK_DAYS && dayDiff <= 60) score += 1;
				else if (dayDiff <= 120) score += 0.5;
			}

			return { tx: t, score };
		})
		.filter((s) => s.score >= RELATED_MIN_SCORE)
		.sort((a, b) => b.score - a.score)
		.slice(0, RELATED_TOP_K);

	return scored.map(({ tx }) => ({
		id: tx.id,
		shopName: tx.shopName,
		date: tx.date,
		amount: tx.amount,
		type: tx.type,
		note: tx.note,
	}));
};
