// Per-item write intent versions. Each new write intent for an item bumps a
// monotonic counter; a completion is stale once a newer intent has been
// submitted for the same item. This lets a slow older write fail without
// enqueueing a payload a newer edit already superseded, and lets a stale
// handler skip its local commit so it cannot clobber the newer local value.
// The latest delivered intent is also kept per item so a stale older write
// that succeeds after a newer one was delivered can re-apply the newer value
// instead of leaving the cloud holding the stale payload.
import { getSyncJob, enqueueSyncJob, type SyncQueueJob, type SyncQueueOp } from "./sync-queue.services";

const submitted = new Map<string, number>();

const key = (sheet: string, itemId: string, spreadsheetId?: string | null) =>
	JSON.stringify([spreadsheetId ?? null, sheet, itemId]);

/** Record a new write intent and return its version token. */
export const beginIntent = (
	sheet: string,
	itemId: string,
	spreadsheetId: string | null | undefined,
): number => {
	const k = key(sheet, itemId, spreadsheetId);
	// Persisted jobs may carry versions from an earlier page session.
	const version = Math.max(
		submitted.get(k) ?? 0,
		delivered.get(k)?.version ?? 0,
		getSyncJob(sheet, itemId, spreadsheetId)?.intentVersion ?? 0,
	) + 1;
	submitted.set(k, version);
	return version;
};

/** True when a newer intent for this item supersedes the given version. */
export const isSuperseded = (
	sheet: string,
	itemId: string,
	version: number,
	spreadsheetId: string | null | undefined,
): boolean => (submitted.get(key(sheet, itemId, spreadsheetId)) ?? 0) > version;

export interface DeliveredIntent {
	version: number;
	op: SyncQueueOp;
	payload?: any;
}

// Scoped to the spreadsheet the write targeted: the same itemId in two files
// is two independent rows, so one file's delivery must not reconcile another.
const delivered = new Map<string, DeliveredIntent>();

const deliveredKey = (
	sheet: string,
	itemId: string,
	spreadsheetId?: string | null,
) => key(sheet, itemId, spreadsheetId);

/** Record a delivered write; only the newest version is kept. */
export const recordDeliveredIntent = (
	sheet: string,
	itemId: string,
	spreadsheetId: string | null | undefined,
	version: number,
	op: SyncQueueOp,
	payload?: any,
): void => {
	const k = deliveredKey(sheet, itemId, spreadsheetId);
	const current = delivered.get(k);
	if (!current || version > current.version) {
		delivered.set(k, { version, op, payload });
	}
};

/** The newest delivered intent for this item on this spreadsheet, if any. */
export const getLatestDeliveredIntent = (
	sheet: string,
	itemId: string,
	spreadsheetId?: string | null,
): DeliveredIntent | undefined =>
	delivered.get(deliveredKey(sheet, itemId, spreadsheetId));

/** Test hook: drop all tracked intents. */
export const resetWriteIntents = (): void => {
	submitted.clear();
	delivered.clear();
};
/** Repair a replay that completed after a newer delivery, including races during repair. */
export const completeReplay = async (
	job: SyncQueueJob,
	spreadsheetId: string,
	write: (intent: DeliveredIntent) => Promise<unknown>,
): Promise<void> => {
	recordDeliveredIntent(job.sheet, job.itemId, spreadsheetId, job.intentVersion ?? 0, job.op, job.payload);
	let version = job.intentVersion ?? 0;
	for (;;) {
		const latest = getLatestDeliveredIntent(job.sheet, job.itemId, spreadsheetId);
		if (!latest || latest.version <= version) return;
		try {
			await write(latest);
		} catch (error) {
			const current = getLatestDeliveredIntent(job.sheet, job.itemId, spreadsheetId)!;
			if (current.version > latest.version) continue;
			const pending = getSyncJob(job.sheet, job.itemId, spreadsheetId);
			if (!pending || (pending.intentVersion ?? 0) < current.version) {
				enqueueSyncJob({ sheet: job.sheet, itemId: job.itemId, spreadsheetId,
					intentVersion: current.version, op: current.op, payload: current.payload });
			}
			throw error;
		}
		version = latest.version;
	}
};
