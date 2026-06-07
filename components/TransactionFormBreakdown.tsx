import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";
import { formatCalculatorAmount } from "../helpers/amount-calculator";

type BreakdownProps = {
	form: TransactionFormState & TransactionFormActions;
};

const currencySymbol = (c: string) => (c === "MYR" ? "RM" : "$");

const sumBreakdown = (items: Array<{ amount: string }>) =>
	items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

const formatMoney = (n: number) =>
	n.toLocaleString(undefined, { minimumFractionDigits: 2 });

export const TransactionFormBreakdown = ({ form }: BreakdownProps) => {
	const allocated = sumBreakdown(form.breakdownItems);
	const remaining = parseFloat(form.amount || "0") - allocated;
	const isOver = remaining < 0;

	return (
		<div className="border-t border-gray-800 pt-5">
			<button
				type="button"
				onClick={() => form.setBreakdownEnabled(!form.breakdownEnabled)}
				className="flex items-center justify-between w-full text-xs font-bold text-gray-400 mb-3 hover:text-white transition-colors"
			>
				<span className="flex items-center gap-2">
					<PlusIcon className="w-3 h-3" />
					Add Amount Breakdown
				</span>
				{form.breakdownEnabled ? (
					<ChevronUpIcon className="w-4 h-4" />
				) : (
					<ChevronDownIcon className="w-4 h-4" />
				)}
			</button>

			{form.breakdownEnabled && (
				<div className="space-y-3 animate-fadeIn mb-4">
					{form.breakdownItems.map((item) => (
						<div key={item.id} className="flex gap-2 items-center group">
							<input
								type="text"
								placeholder="e.g., Burger"
								value={item.description}
								onChange={(e) =>
									form.updateBreakdownItem(item.id, "description", e.target.value)
								}
								className="flex-1 min-w-0 bg-gray-900/50 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary transition-all"
							/>
							<div className="w-24 shrink-0">
								<input
									type="text"
									inputMode="decimal"
									placeholder="0.00"
									value={item.amount || ""}
									onChange={(e) =>
										form.updateBreakdownItem(
											item.id,
											"amount",
											formatCalculatorAmount(e.target.value, item.amount),
										)
									}
									className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary text-right font-mono"
								/>
							</div>
							<button
								type="button"
								onClick={() => form.removeBreakdownItem(item.id)}
								className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
							>
								<TrashIcon className="w-4 h-4" />
							</button>
						</div>
					))}

					<button
						type="button"
						onClick={form.addBreakdownItem}
						className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
					>
						<PlusIcon className="w-3 h-3" /> Add Item
					</button>

					{form.breakdownItems.length > 0 && (
						<div className="flex justify-between items-center px-3 py-3 bg-gray-900/40 rounded-xl border border-gray-800">
							<div className="flex flex-col">
								<span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
									Allocated
								</span>
								<span className="text-xs font-mono font-bold text-indigo-400">
									{currencySymbol(form.currency)} {formatMoney(allocated)}
								</span>
							</div>
							<div className="flex flex-col text-right">
								<span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
									Remaining
								</span>
								<span
									className={`text-xs font-mono font-bold ${isOver ? "text-red-500" : "text-gray-400"}`}
								>
									{currencySymbol(form.currency)} {formatMoney(remaining)}
								</span>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
