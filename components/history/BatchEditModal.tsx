import React from "react";
import {
	PencilIcon,
	FunnelIcon,
	CalendarIcon,
	ClockIcon,
	SparklesIcon,
} from "@heroicons/react/24/solid";
import { Transaction, Category, Pot, SavingPocket } from "../../types";
import Modal from "../Modal";
import DatePicker from "../DatePicker";
import { TriStateSelect } from "./TriStateSelect";

interface Props {
	isOpen: boolean;
	selectedCount: number;
	batchUpdates: Partial<Transaction>;
	categories: Category[];
	pots: Pot[];
	pockets: SavingPocket[];
	isSubmitting: boolean;
	onClose: () => void;
	onBatchUpdatesChange: (updates: Partial<Transaction>) => void;
	onSubmit: () => void;
}

const stripKey = <T extends object, K extends keyof T>(
	obj: T,
	key: K,
): Omit<T, K> => {
	const { [key]: _omitted, ...rest } = obj;
	return rest;
};

const BatchEditModal: React.FC<Props> = ({
	isOpen,
	selectedCount,
	batchUpdates,
	categories,
	pots,
	pockets,
	isSubmitting,
	onClose,
	onBatchUpdatesChange,
	onSubmit,
}) => {
	const update = (patch: Partial<Transaction>) => {
		onBatchUpdatesChange({ ...batchUpdates, ...patch });
	};

	const handleTriState = <K extends keyof Transaction>(
		key: K,
		next: { value: string | null | undefined; omitKey: boolean },
	) => {
		if (next.omitKey) {
			onBatchUpdatesChange(stripKey(batchUpdates, key));
		} else {
			update({ [key]: next.value } as Partial<Transaction>);
		}
	};

	const potOptions = pots.map((p) => ({ value: p.id, label: p.name }));
	const pocketOptions = pockets.map((p) => ({
		value: p.id,
		label: `${p.icon} ${p.name}`,
	}));

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`Batch Edit ${selectedCount} items`}
			maxWidth="max-w-md"
		>
			<div className="flex flex-col max-h-[70vh]">
				<div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 -mr-2">
					<div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
						<p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
							Note
						</p>
						<p className="text-gray-400 text-xs leading-relaxed">
							Batch editing is limited to non-financial fields to prevent
							accidental balance corruption. Amounts and accounts must be
							edited individually.
						</p>
					</div>

					<div className="space-y-4">
						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
								<PencilIcon className="w-3.5 h-3.5" /> Title
							</label>
							<input
								type="text"
								value={batchUpdates.shopName || ""}
								onChange={(e) => update({ shopName: e.target.value })}
								placeholder="Leave blank to keep unchanged"
								className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
								<FunnelIcon className="w-3.5 h-3.5" /> Category
							</label>
							<select
								value={batchUpdates.categoryId || "KEEP"}
								onChange={(e) => {
									const val = e.target.value;
									if (val === "KEEP") {
										onBatchUpdatesChange(stripKey(batchUpdates, "categoryId"));
									} else {
										update({ categoryId: val });
									}
								}}
								className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
							>
								<option value="KEEP" className="bg-surface">
									— Keep Unchanged —
								</option>
								{categories.map((c) => (
									<option key={c.id} value={c.id} className="bg-surface">
										{c.icon} {c.name}
									</option>
								))}
							</select>
						</div>

						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
								<CalendarIcon className="w-3.5 h-3.5" /> Date
							</label>
							<DatePicker
								value={batchUpdates.date || ""}
								onChange={(date) => update({ date })}
							/>
						</div>

						<div className="space-y-2">
							<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
								<ClockIcon className="w-3.5 h-3.5" /> Time
							</label>
							<input
								type="time"
								value={batchUpdates.time || ""}
								onChange={(e) => update({ time: e.target.value })}
								className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
							/>
						</div>

						<TriStateSelect
							id="batchPot"
							label="Assign to Limit (Pot)"
							currentValue={batchUpdates.potId}
							removeLabel="None (Remove from Pot)"
							icon={<SparklesIcon className="w-3.5 h-3.5" />}
							options={potOptions}
							onChange={(next) => handleTriState("potId", next)}
						/>

						<div className="space-y-4">
							<TriStateSelect
								id="batchSrcPocket"
								label="Assign to source pocket"
								currentValue={batchUpdates.savingPocketId}
								removeLabel="None (Remove from Pocket)"
								icon={<SparklesIcon className="w-3.5 h-3.5" />}
								options={pocketOptions}
								onChange={(next) => handleTriState("savingPocketId", next)}
							/>

							<TriStateSelect
								id="batchDestPocket"
								label="Assign to destination pocket"
								currentValue={batchUpdates.toSavingPocketId}
								removeLabel="None (Remove from Pocket)"
								icon={<SparklesIcon className="w-3.5 h-3.5 text-emerald-400" />}
								options={pocketOptions}
								onChange={(next) => handleTriState("toSavingPocketId", next)}
							/>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/5 bg-surface mt-2">
					<button
						onClick={onClose}
						className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-400 transition-all"
					>
						Cancel
					</button>
					<button
						onClick={onSubmit}
						disabled={Object.keys(batchUpdates).length === 0 || isSubmitting}
						className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-xl shadow-indigo-500/20"
					>
						{isSubmitting ? "Applying Changes..." : "Apply Changes"}
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default BatchEditModal;
