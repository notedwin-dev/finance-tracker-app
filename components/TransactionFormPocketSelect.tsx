import { SparklesIcon } from "@heroicons/react/24/outline";
import type { SavingPocket } from "../types";

type Props = {
	label: string;
	value: string;
	pockets: SavingPocket[];
	onChange: (id: string) => void;
	iconClassName?: string;
	className?: string;
};

export const TransactionFormPocketSelect = ({
	label,
	value,
	pockets,
	onChange,
	iconClassName = "text-indigo-400",
	className = "",
}: Props) => (
	<div className={className}>
		<label className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-2">
			<SparklesIcon className={`w-3.5 h-3.5 ${iconClassName}`} />
			<span>{label}</span>
		</label>
		<div className="relative">
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none transition-colors"
			>
				<option value="">No Pocket Selected</option>
				{pockets.map((p) => (
					<option key={p.id} value={p.id}>
						{p.icon} {p.name} ({p.currency} {p.currentAmount.toLocaleString()})
					</option>
				))}
			</select>
		</div>
	</div>
);
