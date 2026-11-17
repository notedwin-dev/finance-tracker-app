// A full save writes arrays captured at merge time. A live write can commit
// while that save is in flight, and the older snapshot then overwrites the
// newer row. The live write already acknowledged any pending queue job, so
// replay has nothing left to repair: the full save must re-apply what changed
// since its snapshot, or the newer intent is lost from Sheets.
export interface SnapshotCollection<T extends { id: string }> {
	sheet: string;
	// Rows the full save wrote.
	rows: T[];
	// Rows in local storage now.
	current: () => T[];
}

export interface NewerIntent<T extends { id: string }> {
	version: number;
	op: "insert" | "update" | "delete";
	payload?: T;
}

export interface ReconcileDeps<T extends { id: string }> {
	upsert: (sheet: string, item: T) => Promise<unknown>;
	remove: (sheet: string, id: string) => Promise<unknown>;
	// Keep a repair that could not be delivered for the next sync instead of
	// dropping the newer value. intentVersion is the version the repair was
	// based on, so replay ordering stays correct.
	queue: (
		sheet: string,
		op: "update" | "delete",
		itemId: string,
		payload?: T,
		intentVersion?: number,
	) => void;
	// Newest intent already delivered for the item, if any. A live write can
	// be delivered while a repair is in flight and this older repair then
	// overwrites it; re-applying the newest delivered intent keeps cloud on
	// the newer value.
	latestIntent?: (
		sheet: string,
		itemId: string,
	) => NewerIntent<T> | undefined;
	// Version of a write still waiting in the queue, if any. Queueing an
	// older repair would replace that newer pending write (latest-wins).
	pendingVersion?: (sheet: string, itemId: string) => number | undefined;
}

const fingerprint = (row: { id: string }) => JSON.stringify(row);

/**
 * Replacement semantics for a repaired row. The full save wrote every field of
 * its snapshot, but upsertRow only writes fields present in the payload, so a
 * field the local row has since dropped must be blanked explicitly or the
 * snapshot's older value survives in Sheets. Fields the snapshot never had are
 * left alone, so legacy columns stay untouched.
 */
const withClearedFields = <T extends { id: string }>(
	snapshot: T,
	current: T,
): T => {
	const payload: Record<string, unknown> = { ...current };
	for (const key of Object.keys(snapshot)) {
		if (key === "id") continue;
		if (payload[key] === undefined && snapshot[key as keyof T] !== undefined)
			payload[key] = "";
	}
	return payload as T;
};

const applyIntent = async <T extends { id: string }>(
	sheet: string,
	itemId: string,
	intent: NewerIntent<T>,
	deps: ReconcileDeps<T>,
) => {
	if (intent.op === "delete" || !intent.payload) await deps.remove(sheet, itemId);
	else await deps.upsert(sheet, intent.payload);
};

/**
 * Queue a repair that could not be written. A newer delivered or pending
 * write for the same item already represents the latest intent: replaying
 * this older repair would either resurrect a value the cloud has moved past
 * or replace the newer pending job, so it is dropped.
 */
const queueRepair = <T extends { id: string }>(
	sheet: string,
	op: "update" | "delete",
	itemId: string,
	payload: T | undefined,
	version: number,
	deps: ReconcileDeps<T>,
) => {
	if ((deps.latestIntent?.(sheet, itemId)?.version ?? 0) > version) return;
	if ((deps.pendingVersion?.(sheet, itemId) ?? 0) > version) return;
	deps.queue(sheet, op, itemId, payload, version);
};

/**
 * A repair is an out-of-band write, so a newer intent delivered while it was
 * in flight landed underneath it. Re-deliver the newest intent (and any that
 * arrive during that re-delivery) so the stale repair cannot win.
 */
const restoreNewerIntents = async <T extends { id: string }>(
	sheet: string,
	itemId: string,
	baseVersion: number,
	deps: ReconcileDeps<T>,
) => {
	let latest = deps.latestIntent?.(sheet, itemId);
	while (latest && latest.version > baseVersion) {
		const intent = latest;
		try {
			await applyIntent(sheet, itemId, intent, deps);
		} catch (error) {
			console.warn(
				`Could not re-apply newer ${intent.op} for ${sheet} ${itemId}; queued for replay`,
				error,
			);
			queueRepair(
				sheet,
				intent.op === "delete" ? "delete" : "update",
				itemId,
				intent.payload,
				intent.version,
				deps,
			);
			return;
		}
		baseVersion = intent.version;
		latest = deps.latestIntent?.(sheet, itemId);
	}
};

const repair = async <T extends { id: string }>(
	sheet: string,
	op: "update" | "delete",
	itemId: string,
	payload: T | undefined,
	version: number,
	deps: ReconcileDeps<T>,
): Promise<boolean> => {
	try {
		if (payload) await deps.upsert(sheet, payload);
		else await deps.remove(sheet, itemId);
	} catch (error) {
		console.warn(
			`Full-save repair failed for ${sheet} ${itemId}; queued for replay`,
			error,
		);
		queueRepair(sheet, op, itemId, payload, version, deps);
		return false;
	}
	await restoreNewerIntents(sheet, itemId, version, deps);
	return true;
};

/**
 * Re-apply every row that changed locally after the full-save snapshot was
 * taken, and remove rows it still wrote but the user has since deleted.
 * Returns the number of repairs that reached the cloud.
 */
export const reconcileFullSave = async <T extends { id: string }>(
	snapshots: SnapshotCollection<T>[],
	deps: ReconcileDeps<T>,
): Promise<number> => {
	let repaired = 0;
	for (const { sheet, rows, current } of snapshots) {
		const written = new Map(
			rows
				.filter((r) => r.id != null)
				.map((r) => [String(r.id), r]),
		);
		// Plan the whole update pass from one read of current rows, pairing
		// each payload with the intent version current now. An intent
		// delivered while an earlier repair awaits is newer than this payload,
		// so restoreNewerIntents re-applies it after the repair lands.
		const plan: {
			id: string;
			payload: T;
			version: number;
		}[] = [];
		for (const row of current()) {
			if (row.id == null) continue;
			const id = String(row.id);
			const snapshot = written.get(id);
			// Unchanged rows need no repair: the full save already wrote them.
			// A row missing from the snapshot was added after the save read its
			// arrays and never reached the cloud, so it is re-inserted.
			if (snapshot && fingerprint(snapshot) === fingerprint(row)) continue;
			plan.push({
				id,
				payload: snapshot ? withClearedFields(snapshot, row) : row,
				version: deps.latestIntent?.(sheet, id)?.version ?? 0,
			});
		}
		for (const { id, payload, version } of plan) {
			if (await repair(sheet, "update", id, payload, version, deps))
				repaired++;
		}
		// Membership index for the deletion pass. Rebuilt after every awaited
		// repair: a row restored locally while that repair was in flight must
		// not be deleted.
		const presentIds = () =>
			new Set(
				current()
					.filter((row) => row.id != null)
					.map((row) => String(row.id)),
			);
		let present = presentIds();
		for (const id of written.keys()) {
			if (present.has(id)) continue;
			const version = deps.latestIntent?.(sheet, id)?.version ?? 0;
			if (await repair(sheet, "delete", id, undefined, version, deps))
				repaired++;
			present = presentIds();
		}
	}
	return repaired;
};
