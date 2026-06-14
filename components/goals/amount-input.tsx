import React from "react";
import { applyAmountFormat } from "../../helpers/amount-calculator";

type AmountInputProps = {
	value: string;
	onChange: (v: string) => void;
	required?: boolean;
	disabled?: boolean;
	className?: string;
};

export const AmountInput: React.FC<AmountInputProps> = ({
	value,
	onChange,
	required,
	disabled,
	className = "",
}) => (
	<input
		type="text"
		inputMode="decimal"
		required={required}
		disabled={disabled}
		value={value}
		onChange={(e) => applyAmountFormat(e.target.value, value, onChange)}
		className={`w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none ${className}`}
		placeholder="0.00"
	/>
);
