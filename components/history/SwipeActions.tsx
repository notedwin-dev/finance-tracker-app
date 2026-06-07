import React from "react";
import { PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/solid";

type Props = {
	onEdit: () => void;
	onDelete: () => void;
	onClose: () => void;
};

export const SwipeActions = ({ onEdit, onDelete, onClose }: Props) => (
	<div className="absolute inset-y-0 right-0 flex items-center pr-4 gap-2 animate-fadeIn">
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onEdit();
			}}
			className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg border border-indigo-500/20 active:scale-95"
			aria-label="Edit transaction"
		>
			<PencilIcon className="w-5 h-5" />
		</button>
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onDelete();
			}}
			className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg border border-rose-500/20 active:scale-95"
			aria-label="Delete transaction"
		>
			<TrashIcon className="w-5 h-5" />
		</button>
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			className="w-12 h-12 bg-white/10 text-gray-500 rounded-full flex items-center justify-center hover:bg-white/20 hover:text-white transition-all shadow-lg border border-white/10 active:scale-95"
			aria-label="Close actions"
		>
			<XMarkIcon className="w-5 h-5" />
		</button>
	</div>
);
