import React from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import type { Account } from "../../types";

export type SavingsBaseModalProps = {
	isOpen: boolean;
	editingId: string | null;
	accounts: Account[];
	name: string;
	target: string;
	current: string;
	isSubmitting: boolean;
	onNameChange: (v: string) => void;
	onTargetChange: (v: string) => void;
	onCurrentChange: (v: string) => void;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
};

type SavingsFormModalProps = {
	title: string;
	subtitle: string;
	submitLabel: string;
	isSubmitting: boolean;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
	children: React.ReactNode;
};

export const SavingsFormModal: React.FC<SavingsFormModalProps> = ({
	title,
	subtitle,
	submitLabel,
	isSubmitting,
	onClose,
	onSubmit,
	children,
}) => (
	<div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
		<div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
			<div className="p-4 sm:p-5 border-b border-gray-700 bg-surface shrink-0 flex justify-between items-center">
				<div>
					<h3 className="text-base sm:text-lg font-bold text-white">
						{title}
					</h3>
					<p className="text-[10px] text-gray-500 font-medium">{subtitle}</p>
				</div>
				<button
					onClick={onClose}
					className="text-gray-400 hover:text-white p-1"
				>
					<XMarkIcon className="w-6 h-6" />
				</button>
			</div>

			<form
				onSubmit={onSubmit}
				className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-20 sm:pb-6"
			>
				{children}

				<div className="flex gap-3 pt-4 shrink-0">
					<button
						type="submit"
						disabled={isSubmitting}
						className={`flex-1 text-white font-bold py-3 sm:py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] text-sm ${
							isSubmitting
								? "bg-gray-600 cursor-not-allowed"
								: "bg-primary hover:bg-primary-hover"
						}`}
					>
						{isSubmitting ? "Saving..." : submitLabel}
					</button>
				</div>
			</form>
		</div>
	</div>
);
