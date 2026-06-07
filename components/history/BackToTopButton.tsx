import React from "react";
import { ArrowUpIcon } from "@heroicons/react/24/solid";

type Props = {
	show: boolean;
	onClick: () => void;
};

export const BackToTopButton = ({ show, onClick }: Props) => {
	if (!show) return null;
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Back to top"
			className="fixed bottom-44 right-6 sm:right-10 z-60 bg-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-500/40 hover:scale-110 active:scale-95 transition-all animate-bounce"
		>
			<ArrowUpIcon className="w-6 h-6" />
		</button>
	);
};
