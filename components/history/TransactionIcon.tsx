import React from "react";
import { TransactionType, Category } from "../../types";
import { cn } from "./cn";

type Props = {
	type: TransactionType;
	categoryId?: string;
	isTransfer: boolean;
	isSelected: boolean;
	categories: Category[];
};

const getCategoryIcon = (categories: Category[], catId?: string): string => {
	const cat = categories.find((c) => c.id === catId);
	return cat ? cat.icon : "📄";
};

export const TransactionIcon = ({
	type,
	categoryId,
	isTransfer,
	isSelected,
	categories,
}: Props) => {
	const showTransferIcon = isTransfer;
	const icon = showTransferIcon
		? "↔️"
		: type === TransactionType.INCOME
			? "💰"
			: getCategoryIcon(categories, categoryId);
	return (
		<div
			className={cn(
				"shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-md sm:text-lg transition-all duration-500",
				isTransfer || isSelected
					? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
					: "bg-surface border border-white/5",
			)}
		>
			{icon}
		</div>
	);
};
