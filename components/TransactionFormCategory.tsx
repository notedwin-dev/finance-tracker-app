import { PlusIcon } from "@heroicons/react/24/outline";
import type { Category } from "../types";
import type { TransactionFormState, TransactionFormActions } from "./useTransactionFormState";

type Props = {
	form: TransactionFormState & TransactionFormActions;
	categories: Category[];
	onManageCategories: () => void;
};

export const TransactionFormCategory = ({ form, categories, onManageCategories }: Props) => (
	<div>
		<div className="flex justify-between items-center mb-1">
			<label className="block text-xs font-medium text-gray-400">Category</label>
			<button
				type="button"
				onClick={onManageCategories}
				className="text-[10px] text-primary hover:text-white font-bold flex items-center gap-1"
			>
				<PlusIcon className="w-3 h-3" /> Manage
			</button>
		</div>
		<div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
			{categories.map((cat) => (
				<button
					key={cat.id}
					type="button"
					onClick={() => form.setCategoryId(cat.id)}
					className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square sm:aspect-auto sm:min-h-15 ${
						form.categoryId === cat.id
							? "bg-primary text-white border-primary"
							: "bg-surface border-gray-800 text-gray-400 hover:border-gray-600"
					}`}
				>
					<span className="text-xl sm:text-lg">{cat.icon}</span>
					<span className="text-[8px] sm:text-[9px] font-medium truncate w-full text-center mt-1">
						{cat.name}
					</span>
				</button>
			))}
		</div>
	</div>
);
