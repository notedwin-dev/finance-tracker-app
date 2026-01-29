import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  UserIcon,
  SparklesIcon,
  ChatBubbleBottomCenterIcon,
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
import { Transaction, Account } from "../types";

import zenLogo from "../images/ZenFinance.svg";

const MainLayout: React.FC = () => {
  const { profile, logout, updateProfile, loginWithGoogle } = useAuth();
  const {
    accounts,
    transactions,
    categories,
    pots,
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
  } = useData();

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
    logout();
    navigate("/", { replace: true });
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
            to="/app/profile"
            icon={UserIcon}
            label="Profile"
            active={location.pathname === "/app/profile"}
          />
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full max-w-7xl">
        {/* Mobile Header */}
        <header className="lg:hidden flex justify-between items-center px-6 py-6 bg-background/90 backdrop-blur-md sticky top-0 z-30 border-b border-gray-800 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="flex items-center gap-2">
            <img
              src={zenLogo}
              alt="ZenFinance Logo"
              className="w-7 h-7 object-contain"
            />
            <h1 className="text-xl font-bold">
              Zen<span className="text-primary">Finance</span>
            </h1>
          </div>
          <Link to="/app/profile">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                className="w-9 h-9 rounded-full border border-gray-700 shadow-md"
                alt="Avatar"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-surface border border-gray-700 flex items-center justify-center shadow-md">
                <UserIcon className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </Link>
        </header>

        <main className="flex-1 p-4 pb-32 lg:pb-8 overflow-y-auto w-full mx-auto">
          <Outlet
            context={{
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

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 w-full z-20">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <button
            onClick={() => setShowAddModal(true)}
            className="pointer-events-auto w-14 h-14 bg-primary rounded-full shadow-lg shadow-indigo-500/50 flex items-center justify-center text-white border-[4px] border-background transform transition-transform active:scale-95"
          >
            <PlusIcon className="w-7 h-7" />
          </button>
        </div>
        <nav className="bg-surface/90 backdrop-blur-xl border-t border-gray-800 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 px-6 h-auto shadow-2xl">
          <div className="flex justify-between items-center h-full max-w-md mx-auto">
            <MobileNavLink
              to="/app"
              icon={HomeIcon}
              iconSolid={HomeIconSolid}
              label="Home"
              active={location.pathname === "/app"}
            />
            <MobileNavLink
              to="/app/history"
              icon={ClockIcon}
              iconSolid={ClockIconSolid}
              label="History"
              active={location.pathname === "/app/history"}
            />
            <div className="w-16"></div>
            <MobileNavLink
              to="/app/goals"
              icon={ChartBarIcon}
              iconSolid={ChartBarIconSolid}
              label="Goals"
              active={location.pathname === "/app/goals"}
            />
            <MobileNavLink
              to="/app/profile"
              icon={UserIcon}
              iconSolid={UserIconSolid}
              label="Profile"
              active={location.pathname === "/app/profile"}
            />
          </div>
        </nav>
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
          onClose={() => setShowSubscriptionManager(false)}
        />
      )}

      {toast && (
        <div
          className={`fixed top-6 right-6 lg:left-auto lg:translate-x-0 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-[100] animate-fadeIn border border-white/10 backdrop-blur-md ${toast.type === "alert" ? "bg-red-500/90 text-white" : "bg-primary/90 text-white"}`}
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
    className={`flex flex-col items-center justify-center w-14 pt-1 transition-colors ${active ? "text-primary" : "text-gray-500"}`}
  >
    {active ? <IconSolid className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
    <span className="text-[10px] font-medium mt-1">{label}</span>
  </Link>
);

export default MainLayout;
