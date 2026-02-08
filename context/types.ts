import {
  Account,
  Category,
  Transaction,
  Goal,
  Subscription,
  Pot,
  SavingPocket,
  ChatSession,
  ExchangeRateData,
} from "../types";
import { CryptoPrices } from "../services/coin.services";

export interface DataContextType {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  subscriptions: Subscription[];
  pots: Pot[];
  pockets: SavingPocket[];
  chatSessions: ChatSession[];
  usdRate: number;
  cryptoPrices: CryptoPrices;
  displayCurrency: "MYR" | "USD";
  setDisplayCurrency: (currency: "MYR" | "USD") => void;
  privacyMode: boolean;
  setPrivacyMode: (value: boolean) => void;
  isVaultEnabled: boolean;
  isVaultCreated: boolean;
  isVaultUnlocked: boolean;
  unlockVault: (password: string) => Promise<boolean>;
  unlockVaultWithBiometrics: () => Promise<boolean>;
  enableBiometricUnlock: (password: string) => Promise<boolean>;
  lockVault: () => void;
  enableVault: (password: string) => Promise<void>;
  disableVault: () => Promise<void>;
  maskAmount: (
    amount: number | string,
    currency?: string,
    isSensitive?: boolean,
  ) => React.ReactNode;
  maskText: (
    text: string,
    isSensitive?: boolean,
    permanentMask?: boolean,
  ) => React.ReactNode;
  exchangeRate: ExchangeRateData | null;
  isSyncing: boolean;
  toast: { message: string; type: "success" | "alert" | "info" } | null;
  showToast: (message: string, type: "success" | "alert" | "info") => void;
  syncData: () => Promise<void>;
  handleSelectExistingSheet: (sheetId?: string) => Promise<void>;
  loadData: () => Promise<void>;
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>;
  setPots: React.Dispatch<React.SetStateAction<Pot[]>>;
  setPockets: React.Dispatch<React.SetStateAction<SavingPocket[]>>;
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  handleAccountSave: (acc: Omit<Account, "userId">) => Promise<void>;
  handleAccountDelete: (id: string) => Promise<void>;
  handleTransactionSubmit: (
    tx: Omit<Transaction, "userId">,
    newSubscription?: Omit<Subscription, "userId" | "id">,
    isDestHistorical?: boolean,
  ) => Promise<void>;
  handleBulkTransactionImport: (
    newTxs: Partial<Transaction>[],
    accountId: string,
    options?: { adjustBalance?: boolean; isHistorical?: boolean },
  ) => Promise<void>;
  handleTransactionDelete: (id: string) => Promise<void>;
  handleBatchTransactionDelete: (ids: string[]) => Promise<void>;
  handleBatchTransactionEdit: (
    ids: string[],
    updates: Partial<Transaction>,
  ) => Promise<void>;
  handleCategorySave: (cat: Omit<Category, "userId">) => Promise<void>;
  handleCategoryDelete: (id: string) => Promise<void>;
  handleGoalUpdate: (goal: Omit<Goal, "userId">) => Promise<void>;
  handleGoalDelete: (id: string) => Promise<void>;
  handlePotSave: (pot: Omit<Pot, "userId">) => Promise<void>;
  handlePotDelete: (id: string) => Promise<void>;
  handlePocketSave: (pocket: Omit<SavingPocket, "userId">) => Promise<void>;
  handlePocketDelete: (id: string) => Promise<void>;
  handleAddSubscription: (sub: Omit<Subscription, "userId">) => Promise<void>;
  handleDeleteSubscription: (id: string) => Promise<void>;
  handleSaveChatSession: (session: ChatSession) => void;
  handleDeleteChatSession: (id: string) => void;
  handleMigrateData: () => Promise<void>;
  handleResetAndSync: () => Promise<void>;
  recalculateBalances: (
    startDateArg?: string | any,
    endDateArg?: string | any,
  ) => Promise<void>;
  getTotalValueReceived: (tx: Transaction) => number;
  calculateGXBankInterest: (
    balance: number,
    pocketType: "SAVING_POCKET" | "BONUS_POCKET",
    tenureMonths?: 2 | 3,
  ) => number;
}
