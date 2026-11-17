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

export interface ReconcileDeps<T extends { id: string }> {
	upsert: (sheet: string, item: T) => Promise<unknown>;
	remove: (sheet: string, id: string) => Promise<unknown>;
	// Keep a repair that could not be delivered for the next sync instead of
	// dropping the newer value.
	queue: (
		sheet: string,
		op: "update" | "delete",
		itemId: string,
		payload?: T,
	) => void;
}

const fingerprint = (row: { id: string }) => JSON.stringify(row);

const repair = async <T extends { id: string }>(
	sheet: string,
	op: "update" | "delete",
	itemId: string,
	payload: T | undefined,
	deps: ReconcileDeps<T>,
): Promise<boolean> => {
	try {
		if (payload) await deps.upsert(sheet, payload);
		else await deps.remove(sheet, itemId);
		return true;
	} catch (error) {
		console.warn(
			`Full-save repair failed for ${sheet} ${itemId}; queued for replay`,
			error,
		);
		deps.queue(sheet, op, itemId, payload);
		return false;
	}
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
				.map((r) => [String(r.id), fingerprint(r)]),
		);
		const present = new Set<string>();
		for (const row of current()) {
			if (row.id == null) continue;
			const id = String(row.id);
			present.add(id);
			// Unchanged rows need no repair: the full save already wrote them.
			if (written.get(id) === fingerprint(row)) continue;
			if (await repair(sheet, "update", id, row, deps)) repaired++;
		}
		for (const id of written.keys()) {
			if (present.has(id)) continue;
			if (await repair(sheet, "delete", id, undefined, deps)) repaired++;
		}
	}
	return repaired;
};
