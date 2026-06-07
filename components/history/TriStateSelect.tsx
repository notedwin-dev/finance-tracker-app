import React from "react";

type TriStateValue = "KEEP" | "REMOVE" | string;

const displayValue = (
	raw: string | null | undefined,
): TriStateValue => {
	if (raw === undefined) return "KEEP";
	if (raw === null || raw === "") return "REMOVE";
	return raw;
};

const applyTriState = (
	raw: string | null | undefined,
	choice: TriStateValue,
): { value: string | null; omitKey: boolean } => {
	if (choice === "KEEP") return { value: raw as string | null, omitKey: false };
	if (choice === "REMOVE") return { value: undefined as unknown as string | null, omitKey: true };
	return { value: choice, omitKey: false };
};

type Option = { value: string; label: string };

type Props = {
	id: string;
	label: string;
	currentValue: string | null | undefined;
	keepLabel?: string;
	removeLabel: string;
	options: Option[];
	icon?: React.ReactNode;
	onChange: (next: { value: string | null | undefined; omitKey: boolean }) => void;
	className?: string;
};

export const TriStateSelect = ({
	id,
	label,
	currentValue,
	keepLabel = "— Keep Unchanged —",
	removeLabel,
	options,
	icon,
	onChange,
	className = "",
}: Props) => {
	const selected = displayValue(currentValue);
	return (
		<div className={`space-y-2 ${className}`}>
			<label
				htmlFor={id}
				className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"
			>
				{icon} {label}
			</label>
			<select
				id={id}
				value={selected}
				onChange={(e) => {
					const result = applyTriState(currentValue, e.target.value as TriStateValue);
					onChange({ value: result.value, omitKey: result.omitKey });
				}}
				className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
			>
				<option value="KEEP" className="bg-surface">
					{keepLabel}
				</option>
				<option value="REMOVE" className="bg-surface">
					{removeLabel}
				</option>
				{options.map((o) => (
					<option key={o.value} value={o.value} className="bg-surface">
						{o.label}
					</option>
				))}
			</select>
		</div>
	);
};
