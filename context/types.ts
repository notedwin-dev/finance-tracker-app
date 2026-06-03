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
  unlockVaultWithTOTP: (totpCode: string) => Promise<boolean>;
  unlockVaultWithBiometrics: () => Promise<boolean>;
  enableBiometricUnlock: () => Promise<boolean>;
  lockVault: () => void;
  enableVault: () => Promise<void>;
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
}
