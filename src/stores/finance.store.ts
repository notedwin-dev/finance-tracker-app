import { create } from "zustand";
import {
  Account, Category, Transaction, Goal, Subscription,
  Pot, SavingPocket, ChatSession, ExchangeRateData,
} from "../../types";
import { CryptoPrices } from "../../services/coin.services";

export interface FinanceState {
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
  exchangeRate: ExchangeRateData | null;
}

export interface FinanceActions {
  setAccounts: (accounts: Account[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setCategories: (categories: Category[]) => void;
  setGoals: (goals: Goal[]) => void;
  setSubscriptions: (subscriptions: Subscription[]) => void;
  setPots: (pots: Pot[]) => void;
  setPockets: (pockets: SavingPocket[]) => void;
  setChatSessions: (sessions: ChatSession[]) => void;
  setUsdRate: (rate: number) => void;
  setCryptoPrices: (prices: CryptoPrices) => void;
  setExchangeRate: (rate: ExchangeRateData | null) => void;

  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  removeTransactions: (ids: string[]) => void;

  addAccount: (account: Account) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;

  addCategory: (cat: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  removeCategory: (id: string) => void;

  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  removeGoal: (id: string) => void;

  addPot: (pot: Pot) => void;
  updatePot: (id: string, updates: Partial<Pot>) => void;
  removePot: (id: string) => void;

  addPocket: (pocket: SavingPocket) => void;
  updatePocket: (id: string, updates: Partial<SavingPocket>) => void;
  removePocket: (id: string) => void;

  addSubscription: (sub: Subscription) => void;
  updateSubscription: (id: string, updates: Partial<Subscription>) => void;
  removeSubscription: (id: string) => void;

  addChatSession: (session: ChatSession) => void;
  removeChatSession: (id: string) => void;

  replaceAll: (data: Partial<FinanceState>) => void;
  reset: () => void;
}

const initialState: FinanceState = {
  accounts: [],
  transactions: [],
  categories: [],
  goals: [],
  subscriptions: [],
  pots: [],
  pockets: [],
  chatSessions: [],
  usdRate: 4.45,
  cryptoPrices: { BTC: 65000, ETH: 3500 },
  exchangeRate: null,
};

export const useFinanceStore = create<FinanceState & FinanceActions>((set) => ({
  ...initialState,

  setAccounts: (accounts) => set({ accounts }),
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
  setGoals: (goals) => set({ goals }),
  setSubscriptions: (subscriptions) => set({ subscriptions }),
  setPots: (pots) => set({ pots }),
  setPockets: (pockets) => set({ pockets }),
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  setUsdRate: (rate) => set({ usdRate: rate }),
  setCryptoPrices: (prices) => set({ cryptoPrices: prices }),
  setExchangeRate: (rate) => set({ exchangeRate: rate }),

  addTransaction: (tx) =>
    set((state) => ({ transactions: [...state.transactions, tx] })),
  updateTransaction: (id, updates) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),
  removeTransactions: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      transactions: state.transactions.filter((t) => !idSet.has(t.id)),
    }));
  },

  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),
  updateAccount: (id, updates) =>
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      ),
    })),
  removeAccount: (id) =>
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    })),

  addCategory: (cat) =>
    set((state) => ({ categories: [...state.categories, cat] })),
  updateCategory: (id, updates) =>
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      ),
    })),
  removeCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    })),

  addGoal: (goal) =>
    set((state) => ({ goals: [...state.goals, goal] })),
  updateGoal: (id, updates) =>
    set((state) => ({
      goals: state.goals.map((g) =>
        g.id === id ? { ...g, ...updates } : g,
      ),
    })),
  removeGoal: (id) =>
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
    })),

  addPot: (pot) =>
    set((state) => ({ pots: [...state.pots, pot] })),
  updatePot: (id, updates) =>
    set((state) => ({
      pots: state.pots.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    })),
  removePot: (id) =>
    set((state) => ({
      pots: state.pots.filter((p) => p.id !== id),
    })),

  addPocket: (pocket) =>
    set((state) => ({ pockets: [...state.pockets, pocket] })),
  updatePocket: (id, updates) =>
    set((state) => ({
      pockets: state.pockets.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    })),
  removePocket: (id) =>
    set((state) => ({
      pockets: state.pockets.filter((p) => p.id !== id),
    })),

  addSubscription: (sub) =>
    set((state) => ({ subscriptions: [...state.subscriptions, sub] })),
  updateSubscription: (id, updates) =>
    set((state) => ({
      subscriptions: state.subscriptions.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    })),
  removeSubscription: (id) =>
    set((state) => ({
      subscriptions: state.subscriptions.filter((s) => s.id !== id),
    })),

  addChatSession: (session) =>
    set((state) => ({ chatSessions: [...state.chatSessions, session] })),
  removeChatSession: (id) =>
    set((state) => ({
      chatSessions: state.chatSessions.filter((s) => s.id !== id),
    })),

  replaceAll: (data) => set((state) => ({ ...state, ...data })),

  reset: () => set(initialState),
}));
