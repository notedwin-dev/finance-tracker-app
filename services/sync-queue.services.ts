import { getKey } from "../helpers/storage.helper";
import { KEYS } from "./storage.services";

export type SyncQueueOp = "insert" | "update" | "delete";

export interface SyncQueueJob {
	sheet: string;
	op: SyncQueueOp;
	itemId: string;
	// Cloud-ready row: any sensitive fields must already be encrypted before
	// a job is enqueued — replay sends the payload as-is.
	payload?: any;
	createdAt: number;
}

const queueKey = () => getKey("zenfinance_sync_queue_v1", KEYS.PROFILE);

const readJobs = (): SyncQueueJob[] => {
	try {
		const raw = localStorage.getItem(queueKey());
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const writeJobs = (jobs: SyncQueueJob[]) => {
	localStorage.setItem(queueKey(), JSON.stringify(jobs));
};

/**
 * Queue a failed cloud write for replay after the next successful sync.
 * Latest-wins per (sheet, itemId): replay uses upsert (insert-if-missing)
 * and no-op-if-absent delete, so collapsing a pending insert+update into
 * the newest payload — or an insert+delete into a delete — is safe.
 */
export const enqueueSyncJob = (job: Omit<SyncQueueJob, "createdAt">): boolean => {
	const jobs = readJobs();
	const entry: SyncQueueJob = { ...job, createdAt: Date.now() };
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
): T[] => {
	const pending = jobs.filter((j) => j.sheet === sheet);
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
 * queue: a write enqueued mid-drain must survive, and a coalesced replacement
 * of the job just replayed (newer createdAt) is kept for the next pass.
 */
export const drainSyncQueue = async (deps: {
	upsert: (sheet: string, item: any) => Promise<void>;
	remove: (sheet: string, id: string) => Promise<void>;
}): Promise<{ processed: number; remaining: number }> => {
	let processed = 0;
	for (;;) {
		const job = readJobs()[0];
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
				j.createdAt === job.createdAt,
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