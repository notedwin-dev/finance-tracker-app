import React from "react";

type IconKind = "user" | "envelope" | "lock";

const iconPath: Record<IconKind, React.ReactNode> = {
	user: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
		/>
	),
	envelope: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
		/>
	),
	lock: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
		/>
	),
};

const Icon = ({ kind }: { kind: IconKind }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor"
		aria-hidden="true"
	>
		{iconPath[kind]}
	</svg>
);

type Props = {
	id: string;
	label: string;
	icon: IconKind;
	type: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	required?: boolean;
};

export const AuthInput = ({
	id,
	label,
	icon,
	type,
	value,
	onChange,
	placeholder,
	required = true,
}: Props) => (
	<div>
		<label
			htmlFor={id}
			className="block text-xs font-medium text-gray-500 mb-1 ml-1 uppercase tracking-wider"
		>
			{label}
		</label>
		<div className="relative">
			<span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none">
				<Icon kind={icon} />
			</span>
			<input
				id={id}
				type={type}
				required={required}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full bg-card border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
				placeholder={placeholder}
			/>
		</div>
	</div>
);
