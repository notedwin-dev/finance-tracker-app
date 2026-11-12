import { getKey } from "../helpers/storage.helper";
import { KEYS } from "./storage.services";

export type SyncQueueOp = "insert" | "update" | "delete";

export interface SyncQueueJob {
	// Unique per enqueue so a same-millisecond replacement is not mistaken
	// for the job just replayed. Absent on legacy jobs persisted before ids.
	id?: string;
	sheet: string;
	op: SyncQueueOp;
	itemId: string;
	// Cloud-ready row: any sensitive fields must already be encrypted before
	// a job is enqueued — replay sends the payload as-is.
	payload?: any;
	// Spreadsheet the failed write targeted. Replay/merge skip jobs bound to
	// a different spreadsheet so one file's edits never enter another's save.
	// Absent on legacy jobs and before any spreadsheet has been resolved.
	spreadsheetId?: string | null;
	createdAt: number;
}

const queueKey = () => getKey("zenfinance_sync_queue_v1", KEYS.PROFILE);

const isValidJob = (j: any): j is SyncQueueJob =>
	!!j &&
	typeof j === "object" &&
	typeof j.sheet === "string" &&
	typeof j.itemId === "string" &&
	(j.op === "insert" || j.op === "update" || j.op === "delete") &&
	typeof j.createdAt === "number";

const readJobs = (): SyncQueueJob[] => {
	try {
		const raw = localStorage.getItem(queueKey());
		const parsed = raw ? JSON.parse(raw) : [];
		// A corrupt/partial entry (null, missing fields) must not crash a
		// later enqueue or replay; drop it and keep the well-formed jobs.
		return Array.isArray(parsed) ? parsed.filter(isValidJob) : [];
	} catch {
		return [];
	}
};

const writeJobs = (jobs: SyncQueueJob[]) => {
	localStorage.setItem(queueKey(), JSON.stringify(jobs));
};

// A job replays only into the spreadsheet it was queued for. An unknown
// target (caller passed none) or an unbound job (legacy / pre-resolution)
// matches anything, so pending writes are never stranded.
const matchesSpreadsheet = (
	job: SyncQueueJob,
	spreadsheetId?: string,
): boolean =>
	spreadsheetId === undefined ||
	job.spreadsheetId === undefined ||
	job.spreadsheetId === null ||
	job.spreadsheetId === spreadsheetId;

/**
 * Queue a failed cloud write for replay after the next successful sync.
 * Latest-wins per (sheet, itemId): replay uses upsert (insert-if-missing)
 * and no-op-if-absent delete, so collapsing a pending insert+update into
 * the newest payload — or an insert+delete into a delete — is safe.
 */
export const enqueueSyncJob = (job: Omit<SyncQueueJob, "createdAt">): boolean => {
	const jobs = readJobs();
	const entry: SyncQueueJob = {
		...job,
		id: crypto.randomUUID(),
		createdAt: Date.now(),
	};
	const idx = jobs.findIndex(
		(j) => j.sheet === job.sheet && j.itemId === job.itemId,
	);
	if (idx >= 0) jobs[idx] = entry;
	else jobs.push(entry);
	try {
		writeJobs(jobs);
		return true;
	} catch (err) {
		// Full or unavailable storage must never block the local save.
		console.error("Failed to persist sync queue job", err);
		return false;
	}
};

export const getSyncQueue = (): SyncQueueJob[] => readJobs();

/** True when a write for this item is still awaiting cloud acknowledgement. */
export const hasSyncJob = (sheet: string, itemId: string): boolean =>
	readJobs().some((j) => j.sheet === sheet && j.itemId === itemId);

/** The pending job for this item, or undefined. Used to snapshot intent. */
export const getSyncJob = (
	sheet: string,
	itemId: string,
): SyncQueueJob | undefined =>
	readJobs().find((j) => j.sheet === sheet && j.itemId === itemId);

/**
 * Acknowledge a pending job once a newer write for the same item has reached
 * the cloud, so replay cannot clobber the delivered version. No-op when the
 * item is unknown. Returns false when the removal could not be persisted:
 * the stale job is still pending, so the caller must not report "delivered".
 */
export const removeSyncJob = (sheet: string, itemId: string): boolean => {
	const jobs = readJobs();
	const next = jobs.filter((j) => !(j.sheet === sheet && j.itemId === itemId));
	if (next.length === jobs.length) return true;
	try {
		writeJobs(next);
		return true;
	} catch (err) {
		console.error("Failed to update sync queue after acknowledgement", err);
		return false;
	}
};

/**
 * Re-apply pending jobs on top of a cloud/local merge result. A queued job
 * is a local write the cloud never acknowledged, so it must survive the
 * merge: the trust-cloud merge drops local-only items as "deleted" and
 * stamps cloud rows with updatedAt=now, which would otherwise clobber
 * older pending edits. The job stays authoritative until replay succeeds.
 */
export const applyPendingJobs = <T extends { id: string }>(
	merged: T[],
	jobs: SyncQueueJob[],
	sheet: string,
	spreadsheetId?: string,
): T[] => {
	const pending = jobs.filter(
		(j) => j.sheet === sheet && matchesSpreadsheet(j, spreadsheetId),
	);
	if (pending.length === 0) return merged;
	const map = new Map(merged.map((i) => [String(i.id), i]));
	for (const job of pending) {
		if (job.op === "delete") map.delete(job.itemId);
		else if (job.payload?.id) map.set(String(job.payload.id), job.payload);
	}
	return Array.from(map.values());
};

export const clearSyncQueue = () => {
	localStorage.removeItem(queueKey());
};

/**
 * Replay queued jobs in order through the injected writers. Stops at the
 * first failure and keeps the failed job plus everything behind it, so a
 * still-dead session never drops pending writes. Each removal re-reads the
 * queue and matches the job's unique id: a write enqueued mid-drain — even a
 * same-millisecond replacement of the job just replayed — is kept for the
 * next pass. When spreadsheetId is given, only jobs bound to it are replayed;
 * jobs for other spreadsheets stay queued for their own sync.
 */
export const drainSyncQueue = async (
	deps: {
		upsert: (sheet: string, item: any) => Promise<void>;
		remove: (sheet: string, id: string) => Promise<void>;
	},
	spreadsheetId?: string,
): Promise<{ processed: number; remaining: number }> => {
	let processed = 0;
	for (;;) {
		const job = readJobs().find((j) => matchesSpreadsheet(j, spreadsheetId));
		if (!job) break;
		try {
			if (job.op === "delete") await deps.remove(job.sheet, job.itemId);
			else await deps.upsert(job.sheet, job.payload);
		} catch (err) {
			console.warn("Sync queue replay failed; will retry on next sync", err);
			break;
		}
		const current = readJobs();
		const idx = current.findIndex(
			(j) =>
				j.sheet === job.sheet &&
				j.itemId === job.itemId &&
				j.id === job.id,
		);
		if (idx >= 0) {
			current.splice(idx, 1);
			try {
				writeJobs(current);
			} catch (err) {
				console.error("Failed to update sync queue after replay", err);
				break;
			}
		}
		processed++;
	}
	return { processed, remaining: readJobs().length };
};