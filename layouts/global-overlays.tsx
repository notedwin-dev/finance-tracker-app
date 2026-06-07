import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChatBubbleBottomCenterIcon } from "@heroicons/react/24/outline";
import AIInsights from "../components/AIInsights";
import TransactionForm from "../components/TransactionForm";
import AccountForm from "../components/AccountForm";
import CategoryManager from "../components/CategoryManager";
import SubscriptionManager from "../components/SubscriptionManager";
import {
	Account,
	Category,
	ChatSession,
	Goal,
	Pot,
	SavingPocket,
	Subscription,
	Transaction,
} from "../types";

type Toast = { message: string; type: "success" | "alert" | "info" };

type GlobalOverlaysProps = {
	showAI: boolean;
	isOnAiRoute: boolean;
	apiKey: string;
	sessions: ChatSession[];
	activeSessionId: string | null;
	accounts: Account[];
	transactions: Transaction[];
	categories: Category[];
	pots: Pot[];
	pockets: SavingPocket[];
	goals: Goal[];
	subscriptions: Subscription[];
	toast: Toast | null;
	ui: {
		showAddModal: boolean;
		showAccountForm: boolean;
		showCategoryManager: boolean;
		showSubscriptionManager: boolean;
		editingTransaction: Transaction | undefined;
		editingAccount: Account | undefined;
	};
	onCloseAi: () => void;
	onSaveSession: (s: ChatSession) => void;
	onDeleteSession: (id: string) => void;
	onSelectSession: (id: string) => void;
	onNewChat: () => void;
	onCloseTransaction: () => void;
	onSubmitTransaction: (
		tx: Omit<Transaction, "userId">,
		newSubscription?: Omit<Subscription, "userId" | "id">,
		isDestHistorical?: boolean,
	) => Promise<void>;
	onManageCategories: () => void;
	onCloseAccountForm: () => void;
	onSaveAccount: (a: Omit<Account, "userId">) => Promise<void>;
	onDeleteAccount: (id: string) => Promise<void>;
	onCloseCategoryManager: () => void;
	onSaveCategory: (cat: Omit<Category, "userId">) => Promise<void>;
	onDeleteCategory: (id: string) => Promise<void>;
	onCloseSubscriptionManager: () => void;
	onAddSubscription: (s: Omit<Subscription, "userId" | "id">) => Promise<void>;
	onDeleteSubscription: (id: string) => Promise<void>;
	onRecordSubscriptionPayment: (s: Subscription) => void;
};

const Toast: React.FC<{ toast: Toast }> = ({ toast }) => (
	<div
		className={`fixed top-6 right-6 lg:left-auto lg:translate-x-0 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-100 animate-fadeIn border border-white/10 backdrop-blur-md ${
			toast.type === "alert" ? "bg-red-500/90 text-white" : "bg-primary/90 text-white"
		}`}
	>
		<span className="font-bold tracking-wide">{toast.message}</span>
	</div>
);

export const GlobalOverlays: React.FC<GlobalOverlaysProps> = ({
	showAI,
	isOnAiRoute,
	apiKey,
	sessions,
	activeSessionId,
	accounts,
	transactions,
	categories,
	pots,
	pockets,
	goals,
	subscriptions,
	toast,
	ui,
	onCloseAi,
	onSaveSession,
	onDeleteSession,
	onSelectSession,
	onNewChat,
	onCloseTransaction,
	onSubmitTransaction,
	onManageCategories,
	onCloseAccountForm,
	onSaveAccount,
	onDeleteAccount,
	onCloseCategoryManager,
	onSaveCategory,
	onDeleteCategory,
	onCloseSubscriptionManager,
	onAddSubscription,
	onDeleteSubscription,
	onRecordSubscriptionPayment,
}) => {
	return (
		<>
			{showAI && !isOnAiRoute && (
				<Link
					to="/app/ai"
					className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 w-14 h-14 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-2xl z-40 transition-all hover:scale-110 group mb-[env(safe-area-inset-bottom)] lg:mb-0"
				>
					<ChatBubbleBottomCenterIcon className="w-7 h-7" />
				</Link>
			)}

			{isOnAiRoute && (
				<AIInsights
					apiKey={apiKey}
					sessions={sessions}
					activeSessionId={activeSessionId}
					accounts={accounts}
					transactions={transactions}
					categories={categories}
					pots={pots}
					goals={goals}
					subscriptions={subscriptions}
					onClose={onCloseAi}
					onSaveSession={onSaveSession}
					onDeleteSession={onDeleteSession}
					onSelectSession={onSelectSession}
					onNewChat={onNewChat}
				/>
			)}

			{ui.showAddModal && (
				<TransactionForm
					accounts={accounts}
					categories={categories}
					pots={pots}
					pockets={pockets}
					subscriptions={subscriptions}
					initialTransaction={ui.editingTransaction}
					onClose={onCloseTransaction}
					onSubmit={onSubmitTransaction}
					onManageCategories={onManageCategories}
				/>
			)}

			{ui.showAccountForm && (
				<AccountForm
					initialAccount={ui.editingAccount}
					accounts={accounts}
					onSave={onSaveAccount}
					onClose={onCloseAccountForm}
					onDelete={onDeleteAccount}
				/>
			)}

			{ui.showCategoryManager && (
				<CategoryManager
					categories={categories}
					onClose={onCloseCategoryManager}
					onSave={onSaveCategory}
					onDelete={onDeleteCategory}
				/>
			)}

			{ui.showSubscriptionManager && (
				<SubscriptionManager
					subscriptions={subscriptions}
					accounts={accounts}
					categories={categories}
					onAdd={onAddSubscription}
					onDelete={onDeleteSubscription}
					onRecordPayment={onRecordSubscriptionPayment}
					onClose={onCloseSubscriptionManager}
				/>
			)}

			{toast && <Toast toast={toast} />}
		</>
	);
};
