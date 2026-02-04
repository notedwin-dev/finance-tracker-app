import React from "react";
import { useOutletContext } from "react-router-dom";
import Profile from "../components/Profile";
import { useAuth } from "../services/auth.services";
import { useData } from "../context/DataContext";

const ProfilePage: React.FC = () => {
  const { profile, loginWithGoogle, updateProfile, unlinkCloud } = useAuth();
  const {
    isSyncing,
    syncData,
    handleSelectExistingSheet,
    handleResetAndSync,
    handleMigrateData,
    accounts,
    transactions,
    categories,
    goals,
    subscriptions,
    pots,
    pockets,
    chatSessions,
  } = useData();
  const { setShowCategoryManager, setShowSubscriptionManager, handleLogout } =
    useOutletContext<any>();

  const handleExportData = () => {
    const data = {
      profile,
      accounts,
      transactions,
      categories,
      goals,
      subscriptions,
      pots,
      pockets,
      chatSessions,
      exportedAt: new Date().toISOString(),
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
        onSync={syncData}
        onUnlinkCloud={unlinkCloud}
        onResetSync={handleResetAndSync}
        onSelectSheet={handleSelectExistingSheet}
        isSyncing={isSyncing}
      />
    </div>
  );
};

export default ProfilePage;
