import {
  Account,
  Category,
  Transaction,
  Goal,
  Subscription,
  Pot,
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
  chatSessions: ChatSession[];
  usdRate: number;
  cryptoPrices: CryptoPrices;
  displayCurrency: "MYR" | "USD";
  setDisplayCurrency: (currency: "MYR" | "USD") => void;
  privacyMode: boolean;
  setPrivacyMode: (value: boolean) => void;
  isVaultEnabled: boolean;
  isVaultUnlocked: boolean;
  unlockVault: (password: string) => Promise<boolean>;
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
  loadData: () => Promise<void>;
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>;
  setPots: React.Dispatch<React.SetStateAction<Pot[]>>;
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  handleAccountSave: (acc: Omit<Account, "userId">) => Promise<void>;
  handleAccountDelete: (id: string) => Promise<void>;
  handleTransactionSubmit: (tx: Omit<Transaction, "userId">) => Promise<void>;
  handleTransactionDelete: (id: string) => Promise<void>;
  handleCategorySave: (cat: Omit<Category, "userId">) => Promise<void>;
  handleCategoryDelete: (id: string) => Promise<void>;
  handleGoalUpdate: (goal: Omit<Goal, "userId">) => Promise<void>;
  handleGoalDelete: (id: string) => Promise<void>;
  handlePotSave: (pot: Omit<Pot, "userId">) => Promise<void>;
  handlePotDelete: (id: string) => Promise<void>;
  handleAddSubscription: (sub: Omit<Subscription, "userId">) => Promise<void>;
  handleDeleteSubscription: (id: string) => Promise<void>;
  handleSaveChatSession: (session: ChatSession) => void;
  handleDeleteChatSession: (id: string) => void;
  handleMigrateData: () => Promise<void>;
  handleResetAndSync: () => Promise<void>;
}
