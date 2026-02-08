import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  UserIcon,
  Squares2X2Icon,
  SparklesIcon,
  ChatBubbleBottomCenterIcon,
  EyeSlashIcon,
  EyeIcon,
  LinkSlashIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  ClockIcon as ClockIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UserIcon as UserIconSolid,
  SparklesIcon as SparklesIconSolid,
} from "@heroicons/react/24/solid";
import { useAuth } from "../services/auth.services";
import { useData } from "../context/DataContext";
import AIInsights from "../components/AIInsights";
import TransactionForm from "../components/TransactionForm";
import AccountForm from "../components/AccountForm";
import CategoryManager from "../components/CategoryManager";
import SubscriptionManager from "../components/SubscriptionManager";
import { Transaction, Account, TransactionType, Subscription } from "../types";

const zenLogo = "/images/ZenFinance.svg";

const MainLayout: React.FC = () => {
  const { profile, logout, updateProfile, loginWithGoogle } = useAuth();
  const {
    accounts,
    transactions,
    categories,
    pots,
    pockets,
    goals,
    subscriptions,
    chatSessions,
    toast,
    handleTransactionSubmit,
    handleAccountSave,
    handleAccountDelete,
    handleCategorySave,
    handleCategoryDelete,
    handleAddSubscription,
    handleDeleteSubscription,
    handleSaveChatSession,
    handleDeleteChatSession,
    syncData,
    handleMigrateData,
    handleResetAndSync,
    isSyncing,
    privacyMode,
    setPrivacyMode,
  } = useData();

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  // Modals state
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

  const handleLogout = async () => {
    navigate("/", { replace: true });
    setTimeout(() => {
      logout();
    }, 100);
  };

  const handleRecordSubscriptionPayment = (sub: Subscription) => {
    setShowSubscriptionManager(false);
    setEditingTransaction({
      id: crypto.randomUUID(),
      userId: profile.id || "local",
      accountId: sub.accountId,
      amount: sub.amount,
      currency: sub.currency,
      type: TransactionType.EXPENSE,
      categoryId: sub.categoryId,
      shopName: sub.name,
      date: new Date().toLocaleDateString("en-CA"),
      createdAt: new Date().toISOString(),
      subscriptionId: sub.id,
    } as Transaction);
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-background text-gray-100 font-sans flex justify-center">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-surface border-r border-gray-800 p-6 fixed left-0 top-0 z-40">
        <div className="flex items-center gap-3 mb-10">
          <img
            src={zenLogo}
            alt="ZenFinance Logo"
            className="w-8 h-8 object-contain"
          />
          <h1 className="text-xl font-bold tracking-tight text-white">
            ZenFinance
          </h1>
        </div>

        {!isOnline && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
            <div className="flex items-center gap-2 text-rose-500 mb-1">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest">
                No Connection
              </span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
              You are currently disconnected from the internet. Changes will
              sync when online.
            </p>
          </div>
        )}

        {isOnline && profile.offlineMode && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <LinkSlashIcon className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">
                Local Mode
              </span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
              Data is saved only on this device. Cloud sync is disabled.
            </p>
          </div>
        )}

        <nav className="flex-1 space-y-2">
          <SidebarLink
            to="/app"
            icon={HomeIcon}
            label="Dashboard"
            active={location.pathname === "/app"}
          />
          <SidebarLink
            to="/app/history"
            icon={ClockIcon}
            label="Transactions"
            active={location.pathname === "/app/history"}
          />
          <SidebarLink
            to="/app/goals"
            icon={ChartBarIcon}
            label="Goals & Pots"
            active={location.pathname === "/app/goals"}
          />
          <SidebarLink
            to="/app/assets"
            icon={Squares2X2Icon}
            label="My Assets"
            active={location.pathname === "/app/assets"}
          />
          <SidebarLink
            to="/app/profile"
            icon={UserIcon}
            label="Profile"
            active={location.pathname === "/app/profile"}
          />
        </nav>

        {/* Privacy Mode Toggle */}
        <div className="mt-auto space-y-3 pt-6 border-t border-gray-800">
          {!isOnline && (
            <div className="flex items-center gap-3 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                No Connection
              </span>
            </div>
          )}

          {isOnline && profile.offlineMode && (
            <div className="flex items-center gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <LinkSlashIcon className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                Local Only Mode
              </span>
            </div>
          )}

          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="text-gray-400 group-hover:text-indigo-400 transition-colors">
                {privacyMode ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors">
                Privacy Mode
              </span>
            </div>
            <div
              className={`w-8 h-4 rounded-full relative transition-colors ${
                privacyMode ? "bg-indigo-500" : "bg-gray-700"
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                  privacyMode ? "right-1" : "left-1"
                }`}
              />
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full max-w-7xl relative">
        <header className="lg:hidden flex justify-between items-center px-6 h-20 bg-background/90 backdrop-blur-md sticky top-0 z-60 border-b border-gray-800 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <div className="flex items-center gap-2">
            <img
              src={zenLogo}
              alt="ZenFinance Logo"
              className="w-7 h-7 object-contain"
            />
            <h1 className="text-xl font-black text-white tracking-tighter">
              Zen<span className="text-indigo-400 font-black">Finance</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-wider">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                No Connection
              </div>
            )}
            {isOnline && profile.offlineMode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider">
                <LinkSlashIcon className="w-3.5 h-3.5" />
                Offline
              </div>
            )}
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`p-2 rounded-xl transition-all ${
                privacyMode
                  ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                  : "bg-surface border border-gray-800 text-gray-400"
              }`}
            >
              {privacyMode ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
            <Link to="/app/profile" className="relative group">
              {profile.photoUrl ? (
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 overflow-hidden bg-surface shadow-lg group-active:scale-90 transition-transform">
                  <img
                    src={profile.photoUrl}
                    className="w-full h-full object-cover"
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface border-2 border-gray-800 flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                  <UserIcon className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full"></div>
            </Link>
          </div>
        </header>

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

      {/* Mobile Bottom Nav - Floating Island Style */}
      <div className="lg:hidden fixed bottom-6 left-0 w-full px-6 z-40">
        <div className="relative bg-[#0A0A0A]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] px-2 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Centered Add Button */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-16 h-16 bg-indigo-600 rounded-full shadow-[0_8px_20px_rgba(79,70,229,0.4)] flex items-center justify-center text-white border-[6px] border-[#0A0A0A] transform transition-transform active:scale-90"
            >
              <PlusIcon className="w-8 h-8" />
            </button>
          </div>

          <nav className="flex justify-between items-center h-16">
            <div className="flex-1 flex justify-around items-center">
              <MobileNavLink
                to="/app"
                icon={HomeIcon}
                iconSolid={HomeIconSolid}
                label="HOME"
                active={location.pathname === "/app"}
              />
              <MobileNavLink
                to="/app/history"
                icon={ClockIcon}
                iconSolid={ClockIconSolid}
                label="HISTORY"
                active={location.pathname === "/app/history"}
              />
            </div>

            {/* Gap for Add Button */}
            <div className="w-16"></div>

            <div className="flex-1 flex justify-around items-center">
              <MobileNavLink
                to="/app/goals"
                icon={ChartBarIcon}
                iconSolid={ChartBarIconSolid}
                label="GOALS"
                active={location.pathname === "/app/goals"}
              />
              <MobileNavLink
                to="/app/profile"
                icon={UserIcon}
                iconSolid={UserIconSolid}
                label="PROFILE"
                active={location.pathname === "/app/profile"}
              />
            </div>
          </nav>
        </div>
      </div>

      {/* Global Comps */}
      {profile.showAIAssistant && location.pathname !== "/app/ai" && (
        <Link
          to="/app/ai"
          className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 w-14 h-14 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-2xl z-40 transition-all hover:scale-110 group mb-[env(safe-area-inset-bottom)] lg:mb-0"
        >
          <ChatBubbleBottomCenterIcon className="w-7 h-7" />
        </Link>
      )}

      {location.pathname === "/app/ai" && (
        <AIInsights
          apiKey={profile.geminiApiKey}
          sessions={chatSessions}
          activeSessionId={activeChatId}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          pots={pots}
          goals={goals}
          subscriptions={subscriptions}
          onClose={() => navigate(-1)}
          onSaveSession={handleSaveChatSession}
          onDeleteSession={handleDeleteChatSession}
          onSelectSession={setActiveChatId}
          onNewChat={() => setActiveChatId(null)}
        />
      )}

      {showAddModal && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          pots={pots}
          pockets={pockets}
          subscriptions={subscriptions}
          initialTransaction={editingTransaction}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(undefined);
          }}
          onSubmit={handleTransactionSubmit}
          onManageCategories={() => setShowCategoryManager(true)}
        />
      )}

      {showAccountForm && (
        <AccountForm
          initialAccount={editingAccount}
          accounts={accounts}
          onSave={handleAccountSave}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(undefined);
          }}
          onDelete={handleAccountDelete}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onSave={handleCategorySave}
          onDelete={handleCategoryDelete}
        />
      )}

      {showSubscriptionManager && (
        <SubscriptionManager
          subscriptions={subscriptions}
          accounts={accounts}
          categories={categories}
          onAdd={handleAddSubscription}
          onDelete={handleDeleteSubscription}
          onRecordPayment={handleRecordSubscriptionPayment}
          onClose={() => setShowSubscriptionManager(false)}
        />
      )}

      {toast && (
        <div
          className={`fixed top-6 right-6 lg:left-auto lg:translate-x-0 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-100 animate-fadeIn border border-white/10 backdrop-blur-md ${toast.type === "alert" ? "bg-red-500/90 text-white" : "bg-primary/90 text-white"}`}
        >
          <span className="font-bold tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

const SidebarLink = ({ to, icon: Icon, label, active }: any) => (
  <Link
    to={to}
    className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all font-medium ${active ? "bg-primary text-white shadow-lg shadow-indigo-900/30" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
  >
    <Icon className="w-5 h-5" />
    {label}
  </Link>
);

const MobileNavLink = ({
  to,
  icon: Icon,
  iconSolid: IconSolid,
  label,
  active,
}: any) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center pt-1 transition-all ${active ? "text-indigo-400 scale-110" : "text-gray-600 hover:text-gray-400"}`}
  >
    <div
      className={`p-2 rounded-xl transition-all ${active ? "bg-indigo-500/10" : ""}`}
    >
      {active ? (
        <IconSolid className="w-6 h-6" />
      ) : (
        <Icon className="w-6 h-6" />
      )}
    </div>
    <span
      className={`text-[8px] font-black mt-0.5 tracking-widest ${active ? "opacity-100" : "opacity-40"}`}
    >
      {label}
    </span>
  </Link>
);

export default MainLayout;
