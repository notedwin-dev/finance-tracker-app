import React from "react";
import { CheckIcon, ChevronRightIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { TransactionType, Account, SavingPocket, Category } from "../../types";
import { GroupedTransaction } from "../../helpers/transactions.helper";
import { cn } from "./cn";
import { SwipeActions } from "./SwipeActions";
import { TransactionIcon } from "./TransactionIcon";
import { TransactionBadges } from "./TransactionBadges";
import { TransactionAmount } from "./TransactionAmount";

interface Props {
	transaction: GroupedTransaction;
	swipedId: string | null;
	isSelected: boolean;
	showSelection: boolean;
	isBatchMode: boolean;
	accounts: Account[];
	pockets: SavingPocket[];
	categories: Category[];
	maskAmount: (amount: number | string, currency?: string, isSensitive?: boolean) => React.ReactNode;
	maskText: (text: string, isSensitive?: boolean, permanentMask?: boolean) => React.ReactNode;
	onSwipeEdit: () => void;
	onSwipeDelete: () => void;
	onSwipeClose: () => void;
	onClick: () => void;
	onPointerDown: (e: React.PointerEvent) => void;
	onPointerMove: (e: React.PointerEvent) => void;
	onPointerUp: (e: React.PointerEvent) => void;
	onChevronClick: (e: React.MouseEvent) => void;
}

type MaskText = (s: string) => string | React.ReactNode;

const isTransferTx = (t: GroupedTransaction): boolean =>
	!!t.linkedTransaction || t.type === TransactionType.TRANSFER;

const isIncomeTx = (t: GroupedTransaction): boolean =>
	t.type === TransactionType.INCOME ||
	t.type === TransactionType.ACCOUNT_OPENING ||
	(t.type === TransactionType.TRANSFER && t.transferDirection === "IN") ||
	(t.type === TransactionType.ADJUSTMENT && t.amount >= 0);

const getDisplayName = (
	t: GroupedTransaction,
	isTransfer: boolean,
	accounts: Account[],
	maskText: MaskText,
): React.ReactNode => {
	if (isTransfer) {
		if (t.shopName) return maskText(t.shopName);
		const sourceId = t.transferDirection === "IN" ? t.toAccountId : t.accountId;
		const destId = t.transferDirection === "IN" ? t.accountId : t.toAccountId;
		const sourceAccount = accounts.find((a) => a.id === sourceId);
		const destAccount = accounts.find((a) => a.id === destId);
		return (
			<>
				{maskText(sourceAccount?.name || "???")} → {maskText(destAccount?.name || "???")}
			</>
		);
	}
	return maskText(t.shopName || "UNTITLED");
};

const TransactionItem: React.FC<Props> = ({
	transaction: t,
	swipedId,
	isSelected,
	showSelection,
	isBatchMode,
	accounts,
	pockets,
	categories,
	maskAmount,
	maskText,
	onSwipeEdit,
	onSwipeDelete,
	onSwipeClose,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onChevronClick,
}) => {
	const isSwiped = swipedId === t.id;
	const isTransfer = isTransferTx(t);
	const isIncome = isIncomeTx(t);

	return (
		<div className="relative overflow-hidden rounded-4xl group">
			{isSwiped && (
				<SwipeActions
					onEdit={onSwipeEdit}
					onDelete={onSwipeDelete}
					onClose={onSwipeClose}
				/>
			)}

			<div
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onClick();
					}
				}}
				className={cn(
					"relative flex items-center p-4 sm:p-5 bg-card rounded-4xl border transition-all cursor-pointer select-none active:scale-[0.99] shadow-xl touch-pan-y",
					isSwiped ? "-translate-x-48 sm:-translate-x-46" : "translate-x-0",
					isSelected
						? "border-indigo-500 bg-indigo-500/10"
						: "border-white/5 hover:border-indigo-500/30",
				)}
			>
				{showSelection && (
					<div
						className={cn(
							"shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all",
							isSelected
								? "bg-indigo-500 border-indigo-500 scale-110 shadow-lg shadow-indigo-500/30"
								: "border-white/10 group-hover:border-indigo-500/50",
						)}
						role="checkbox"
						aria-checked={isSelected}
						tabIndex={-1}
					>
						{isSelected && <CheckIcon className="w-4 h-4 text-white" />}
					</div>
				)}

				<div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
					<TransactionIcon
						type={t.type}
						categoryId={t.categoryId}
						isTransfer={isTransfer}
						isSelected={isSelected}
						categories={categories}
					/>

					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className="font-extrabold sm:font-black text-white text-[17px] sm:text-lg tracking-tight truncate">
								{getDisplayName(t, isTransfer, accounts, maskText)}
							</p>
							{t.isSubsidized && (
								<SparklesIcon className="w-4 h-4 text-indigo-400 shrink-0 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
							)}
						</div>

						<TransactionBadges
							transaction={t}
							isTransfer={isTransfer}
							pockets={pockets}
							categories={categories}
						/>
					</div>
				</div>

				<div className="flex items-center gap-3 sm:gap-4 shrink-0 px-2">
					<TransactionAmount
						transaction={t}
						isIncome={isIncome}
						maskAmount={maskAmount}
					/>

					{!isBatchMode && !showSelection && (
						<button
							type="button"
							onClick={onChevronClick}
							className="hidden lg:flex p-2 rounded-xl transition-all"
							aria-label={isSwiped ? "Close actions" : "Open actions"}
						>
							<ChevronRightIcon
								className={cn(
									"w-5 h-5 transition-transform duration-300",
									isSwiped
										? "rotate-180 text-white bg-indigo-500 rounded-xl"
										: "text-gray-600",
								)}
							/>
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default TransactionItem;
