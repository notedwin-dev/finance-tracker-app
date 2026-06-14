import React from "react";
import { Account } from "../../types";

type AccountSelectProps = {
	accounts: Account[];
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	className: string;
	required?: boolean;
};

export const AccountSelect: React.FC<AccountSelectProps> = ({
	accounts,
	value,
	onChange,
	placeholder,
	className,
	required,
}) => (
	<select
		required={required}
		value={value}
		onChange={(e) => onChange(e.target.value)}
		className={className}
	>
		<option value="">{placeholder}</option>
		{accounts.map((acc) => (
			<option key={acc.id} value={acc.id}>
				{acc.name} ({acc.currency} {acc.balance.toLocaleString()})
			</option>
		))}
	</select>
);
