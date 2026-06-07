import React from "react";

type Props = {
	validationError: string | null;
	isSubmitting: boolean;
	onSubmit: (e: React.FormEvent) => void;
};

export const TransactionFormFooter = ({ validationError, isSubmitting, onSubmit }: Props) => (
	<div className="p-4 border-t border-gray-800 bg-surface">
		{validationError && (
			<p className="text-red-500 text-xs text-center font-medium mb-3 bg-red-500/10 py-2 rounded-lg border border-red-500/20">
				{validationError}
			</p>
		)}
		<button
			onClick={onSubmit}
			disabled={isSubmitting}
			className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
				isSubmitting
					? "bg-gray-600 cursor-not-allowed"
					: "bg-primary hover:bg-primaryDark shadow-indigo-900/20"
			}`}
		>
			{isSubmitting && (
				<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
			)}
			{isSubmitting ? "Processing..." : "Save Record"}
		</button>
	</div>
);
