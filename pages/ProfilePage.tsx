import React from "react";
import { useOutletContext } from "react-router-dom";
import Profile from "../components/Profile";
import { useAuth } from "../services/auth.services";
import { useFinanceStore } from "../src/stores/finance.store";
import { useSyncStore } from "../src/stores/sync.store";
import { recalculateBalances, migrateData, resetAndSync, selectExistingSheet, syncData } from "../src/lib/application/commands";
import * as SheetService from "../services/sheets.services";
import { logger } from "../src/lib/application/logger";

const ProfilePage: React.FC = () => {
  const { profile, loginWithGoogle, updateProfile, unlinkCloud } = useAuth();
  const {
    accounts,
    transactions,
    categories,
    goals,
    subscriptions,
    chatSessions,
    pots,
    pockets,
    usdRate,
  } = useFinanceStore();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const { setShowCategoryManager, setShowSubscriptionManager, handleLogout } =
    useOutletContext<any>();

  const handleExportData = (startDate?: string, endDate?: string) => {
    let filteredTransactions = [...transactions];

    if (startDate) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.date >= startDate,
      );
    }
    if (endDate) {
      filteredTransactions = filteredTransactions.filter(
        (t) => t.date <= endDate,
      );
    }

    const sanitizedAccounts = accounts.map((a) => {
      const bag = a as unknown as Record<string, unknown>;
      const { details, isEncrypted, ...rest } = bag;
      return rest;
    });

    const ALLOWED_PROFILE_FIELDS = [
      "id",
      "email",
      "name",
      "createdAt",
      "offlineMode",
      "maskMode",
      "schemaVersion",
      "showAIAssistant",
      "syncChatToSheets",
      "lastUpdatedAt",
      "lastSyncAt",
    ];
    const profileRecord = profile as unknown as Record<string, unknown>;
    const sanitizedProfile: Record<string, unknown> = {};
    for (const key of ALLOWED_PROFILE_FIELDS) {
      if (profileRecord[key] !== undefined) {
        sanitizedProfile[key] = profileRecord[key];
      }
    }

    const data = {
      profile: sanitizedProfile,
      accounts: sanitizedAccounts,
      transactions: filteredTransactions,
      categories,
      goals,
      subscriptions,
      pots,
      pockets,
      chatSessions,
      exportedAt: new Date().toISOString(),
      exportRange: {
        startDate: startDate || "all",
        endDate: endDate || "all",
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenfinance_backup_${new Date().toLocaleDateString("en-CA")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRecalculateBalances = async () => {
    try {
      const isCloud = !(profile as any).offlineMode && SheetService.isClientReady();
      await recalculateBalances(
        accounts,
        pots,
        pockets,
        transactions,
        usdRate,
        (profile as any).id || "local",
        isCloud,
      );
    } catch (err) {
      logger.error(err);
    }
  };

  const handleMigrateData = async () => {
    await migrateData();
  };

  const handleResetAndSync = async () => {
    await resetAndSync(profile, updateProfile);
  };

  const handleSelectExistingSheet = async (sheetId?: string) => {
    await selectExistingSheet(sheetId, () => syncData(profile, updateProfile, loginWithGoogle));
  };

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto w-full">
      <div className="mb-8 px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-black text-white">Settings</h1>
        <p className="text-gray-500 text-sm font-medium mt-1">
          Manage your account, data, and preferences
        </p>
      </div>
      <Profile
        profile={profile}
        onLogin={loginWithGoogle}
        onLogout={handleLogout}
        onUpdate={updateProfile}
        onManageCategories={() => setShowCategoryManager(true)}
        onManageSubscriptions={() => setShowSubscriptionManager(true)}
        onExport={handleExportData}
        onMigrate={handleMigrateData}
        onSync={() => syncData(profile, updateProfile, loginWithGoogle)}
        onUnlinkCloud={unlinkCloud}
        onResetSync={handleResetAndSync}
        onSelectSheet={handleSelectExistingSheet}
        onRecalculateBalances={handleRecalculateBalances}
        isSyncing={isSyncing}
      />
    </div>
  );
};

export default ProfilePage;
