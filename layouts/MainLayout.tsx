import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../services/auth.services";
import * as SheetService from "../services/sheets.services";
import { useSyncStore } from "../src/stores/sync.store";
import { useMaskStore } from "../src/stores/mask.store";
import { useFinanceStore } from "../src/stores/finance.store";
import {
	saveCategory,
	deleteCategory,
	addSubscription,
	deleteSubscription,
	saveChatSession,
	deleteChatSession,
	saveAccount,
	deleteAccount,
	submitTransaction,
} from "../src/lib/application/commands";
import { Transaction, Account, Subscription } from "../types";
import { useOnlineStatus } from "./connection-status";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileHeader } from "./mobile-header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { GlobalOverlays } from "./global-overlays";
import { buildSubscriptionPaymentDraft } from "../src/lib/domain/subscription-draft";

const MainLayout: React.FC = () => {
	const { profile, logout } = useAuth();
	const toast = useSyncStore((s) => s.toast);
	const maskMode = useMaskStore((s) => s.maskMode);
	const setMaskMode = useMaskStore((s) => s.setMaskMode);

	const categories = useFinanceStore((s) => s.categories);
	const goals = useFinanceStore((s) => s.goals);
	const subscriptions = useFinanceStore((s) => s.subscriptions);
	const chatSessions = useFinanceStore((s) => s.chatSessions);
	const accounts = useFinanceStore((s) => s.accounts);
	const pots = useFinanceStore((s) => s.pots);
	const pockets = useFinanceStore((s) => s.pockets);
	const storeTransactions = useFinanceStore((s) => s.transactions);

	const isOnline = useOnlineStatus();

	const location = useLocation();
	const navigate = useNavigate();

	const [showAddModal, setShowAddModal] = useState(false);
	const [showAccountForm, setShowAccountForm] = useState(false);
	const [showCategoryManager, setShowCategoryManager] = useState(false);
	const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
	const [activeChatId, setActiveChatId] = useState<string | null>(null);
	const [editingTransaction, setEditingTransaction] = useState<
		Transaction | undefined
	>();
	const [editingAccount, setEditingAccount] = useState<Account | undefined>();

	if (!profile.isLoggedIn) {
		navigate("/");
		return null;
	}

	const isCloudEnabled = !profile.offlineMode && SheetService.isClientReady();
	const userId = profile.id || "local";

	const handleLogout = async () => {
		navigate("/", { replace: true });
		setTimeout(() => logout(), 100);
	};

	const handleRecordSubscriptionPayment = (sub: Subscription) => {
		setShowSubscriptionManager(false);
		setEditingTransaction(buildSubscriptionPaymentDraft(sub, profile.id));
		setShowAddModal(true);
	};

	const handleTransactionSubmit = async (
		tx: Omit<Transaction, "userId">,
		newSubscription?: Omit<Subscription, "userId" | "id">,
		isDestHistorical?: boolean,
	) => {
		const store = useFinanceStore.getState();
		const existingTx = store.transactions.find((t) => t.id === tx.id);
		const linkedRecord = existingTx?.linkedTransactionId
			? store.transactions.find((t) => t.id === existingTx.linkedTransactionId)
			: null;

		await submitTransaction(
			tx,
			store.accounts,
			store.pots,
			store.pockets,
			store.usdRate,
			userId,
			isCloudEnabled,
			existingTx,
			linkedRecord,
			undefined,
			newSubscription,
			store.subscriptions,
			isDestHistorical,
		);
	};

	const closeTransaction = () => {
		setShowAddModal(false);
		setEditingTransaction(undefined);
	};

	const closeAccountForm = () => {
		setShowAccountForm(false);
		setEditingAccount(undefined);
	};

	return (
		<div className="min-h-screen bg-background text-gray-100 font-sans flex justify-center">
			<DesktopSidebar
				isOnline={isOnline}
				offlineMode={profile.offlineMode}
				maskMode={maskMode}
				onToggleMask={() => setMaskMode(!maskMode)}
			/>

			<div className="lg:pl-64 flex flex-col min-h-screen w-full max-w-7xl relative">
				<MobileHeader
					photoUrl={profile.photoUrl}
					isOnline={isOnline}
					offlineMode={profile.offlineMode}
					maskMode={maskMode}
					onToggleMask={() => setMaskMode(!maskMode)}
				/>

				<main className="flex-1 p-4 pb-32 lg:pb-8 w-full mx-auto">
					<Outlet
						context={{
							showAddModal,
							setShowAddModal,
							setEditingTransaction,
							setShowAccountForm,
							setEditingAccount,
							setShowCategoryManager,
							setShowSubscriptionManager,
							handleLogout,
						}}
					/>
				</main>
			</div>

			<MobileBottomNav onAdd={() => setShowAddModal(true)} />

			<GlobalOverlays
				showAI={profile.showAIAssistant}
				isOnAiRoute={location.pathname === "/app/ai"}
				apiKey={profile.geminiApiKey}
				sessions={chatSessions}
				activeSessionId={activeChatId}
				accounts={accounts}
				transactions={storeTransactions}
				categories={categories}
				pots={pots}
				pockets={pockets}
				goals={goals}
				subscriptions={subscriptions}
				toast={toast}
				ui={{
					showAddModal,
					showAccountForm,
					showCategoryManager,
					showSubscriptionManager,
					editingTransaction,
					editingAccount,
				}}
				onCloseAi={() => navigate(-1)}
				onSaveSession={(s) => saveChatSession(s, chatSessions)}
				onDeleteSession={(id) => deleteChatSession(id, chatSessions)}
				onSelectSession={setActiveChatId}
				onNewChat={() => setActiveChatId(null)}
				onCloseTransaction={closeTransaction}
				onSubmitTransaction={handleTransactionSubmit}
				onManageCategories={() => setShowCategoryManager(true)}
				onCloseAccountForm={closeAccountForm}
				onSaveAccount={(a) => saveAccount(a, accounts, storeTransactions, userId, profile)}
				onDeleteAccount={(id) => deleteAccount(id, accounts, storeTransactions)}
				onCloseCategoryManager={() => setShowCategoryManager(false)}
				onSaveCategory={(cat) => saveCategory(cat, categories, userId)}
				onDeleteCategory={(id) => deleteCategory(id, categories)}
				onCloseSubscriptionManager={() => setShowSubscriptionManager(false)}
				onAddSubscription={(s) => addSubscription(s, subscriptions, userId)}
				onDeleteSubscription={(id) => deleteSubscription(id, subscriptions)}
				onRecordSubscriptionPayment={handleRecordSubscriptionPayment}
			/>
		</div>
	);
};

export default MainLayout;
