export enum TransactionType {
  EXPENSE = "EXPENSE",
  INCOME = "INCOME",
  TRANSFER = "TRANSFER",
  ADJUSTMENT = "ADJUSTMENT",
  ACCOUNT_DELETE = "ACCOUNT_DELETE",
  ACCOUNT_OPENING = "ACCOUNT_OPENING",
}

export type Currency = "MYR" | "USD" | string;

export interface ExchangeRateData {
  rate: number;
  date: string;
  source: string;
  lastUpdated?: string;
  history?: {
    date: string;
    rate: number;
  }[];
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  currency: Currency;
  type: "BANK" | "E-WALLET" | "CASH" | "INVESTMENT" | "CRYPTO";
  color: string;
  iconType: "EMOJI" | "IMAGE";
  iconValue: string; // Emoji char or Image URL
  updatedAt?: number; // Timestamp for sync
  userId: string; // User ID owner
  providerId?: string;
  details?: {
    accountNumber?: string;
    cardNumber?: string;
    holderName?: string;
    expiry?: string;
    cvv?: string;
    note?: string;
  };
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  icon: string;
  budgetLimit: number;
  budgetPeriod?: "WEEKLY" | "MONTHLY";
  color: string;
  updatedAt?: number;
  isDefault?: boolean;
}

export interface AmountBreakdownItem {
  id: string;
  description: string;
  amount: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  toAccountId?: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  categoryId?: string;
  shopName: string;
  date: string; // ISO String (YYYY-MM-DD or full ISO)
  time?: string; // Optional time (HH:mm)
  amountBreakdown?: AmountBreakdownItem[];
  createdAt: number; // For sorting and conflict resolution
  note?: string;
  updatedAt?: number;
  linkedTransactionId?: string; // For split transfers
  transferDirection?: "OUT" | "IN";
  potId?: string; // Linked Spending Pot / Limit
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  photoUrl?: string;
  isLoggedIn: boolean;
  updatedAt?: number;
  showAIAssistant?: boolean;
  geminiApiKey?: string;
  syncChatToSheets?: boolean;
  privacyMode?: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  deadline?: string;
  type: "SHORT_TERM" | "LONG_TERM";
  linkedAccountId?: string; // If linked, currentAmount updates automatically
  color: string;
  icon: string;
  updatedAt?: number;
}

export interface Pot {
  id: string;
  userId: string;
  accountId: string; // Linked bank account/e-wallet
  name: string;
  limitAmount: number; // The total budget limit for this pot
  usedAmount: number; // How much has been spent/used so far
  amountLeft: number; // The remaining balance available to spend
  currency: Currency;
  color: string;
  icon: string;
  updatedAt?: number;
}

export type SubscriptionFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  accountId: string;
  categoryId: string;
  nextPaymentDate: string; // YYYY-MM-DD
  frequency: SubscriptionFrequency;
  active: boolean;
}

export interface ChatMessage {
  role: "user" | "model" | "system";
  content: string;
  timestamp: number;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
  status?: "pending" | "approved" | "rejected";
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

// Asset Providers Data
export const ASSET_PROVIDERS = [
  // Banks
  {
    id: "MAYBANK",
    name: "Maybank",
    type: "BANK",
    color: "bg-[#FFC83D]",
    icon: "https://cdn.brandfetch.io/idDo5CJ-3c/w/358/h/356/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1724338872456",
  },
  {
    id: "CIMB",
    name: "CIMB",
    type: "BANK",
    color: "bg-[#ED1C24]",
    icon: "https://cdn.brandfetch.io/idYFvu8CRF/w/400/h/400/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1721275762535",
  },
  {
    id: "RHB",
    name: "RHB",
    type: "BANK",
    color: "bg-[#005DAA]",
    icon: "https://cdn.brandfetch.io/idhyeB4IhB/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1721371610884",
  },
  {
    id: "PUBLIC",
    name: "Public Bank",
    type: "BANK",
    color: "bg-[#CD1316]",
    icon: "https://cdn.brandfetch.io/idV9lBkhx6/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1668076463142",
  },
  {
    id: "HONGLEONG",
    name: "Hong Leong",
    type: "BANK",
    color: "bg-[#B01C2E]",
    icon: "https://cdn.brandfetch.io/idNujJaI1Q/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1668518680136",
  },
  {
    id: "GXBANK",
    name: "GX Bank",
    type: "BANK",
    color: "bg-[#300045]",
    icon: "https://cdn.brandfetch.io/idSuLRzhpk/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1752670667181",
  },

  // E-Wallets
  {
    id: "TNG",
    name: "Touch 'n Go",
    type: "E-WALLET",
    color: "bg-[#005DAA]",
    icon: "https://cdn.brandfetch.io/idKZB3xtpl/w/316/h/316/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1690948653291",
  },
  {
    id: "GRAB",
    name: "GrabPay",
    type: "E-WALLET",
    color: "bg-[#00B14F]",
    icon: "https://cdn.brandfetch.io/idK7W5dzl2/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1721634061201",
  },
  {
    id: "MAE",
    name: "MAE",
    type: "E-WALLET",
    color: "bg-[#FFC83D]",
    icon: "https://cdn.brandfetch.io/idDo5CJ-3c/w/358/h/356/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1724338872456",
  },

  // Investments
  {
    id: "STASHAWAY",
    name: "StashAway",
    type: "INVESTMENT",
    color: "bg-[#372773]",
    icon: "https://cdn.brandfetch.io/idTClWz76O/w/1080/h/1080/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1761496770408",
  },
  {
    id: "VERSA",
    name: "Versa",
    type: "INVESTMENT",
    color: "bg-[#FD3C4F]",
    icon: "https://cdn.brandfetch.io/idv0wZf6sa/w/1200/h/1200/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1763065705582",
  },

  // Crypto
  {
    id: "BTC",
    name: "Bitcoin",
    type: "CRYPTO",
    color: "bg-[#F7931A]",
    icon: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  },
  {
    id: "ETH",
    name: "Ethereum",
    type: "CRYPTO",
    color: "bg-[#627EEA]",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  },
  {
    id: "SOL",
    name: "Solana",
    type: "CRYPTO",
    color: "bg-[#14F195]",
    icon: "https://cryptologos.cc/logos/solana-sol-logo.png",
  },
  {
    id: "TRX",
    name: "TRON",
    type: "CRYPTO",
    color: "bg-[#FF0013]",
    icon: "https://cryptologos.cc/logos/tron-trx-logo.png",
  },
  {
    id: "USDT",
    name: "Tether",
    type: "CRYPTO",
    color: "bg-[#26A17B]",
    icon: "https://cryptologos.cc/logos/tether-usdt-logo.png",
  },
];
