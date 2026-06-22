"use client";

import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import type { Account, Transaction, Category, Goal, Subscription, Pot, SavingPocket, ChatSession } from "@/types";
import * as Storage from "@/services/storage.services";

export interface FinanceState {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  subscriptions: Subscription[];
  pots: Pot[];
  pockets: SavingPocket[];
  chatSessions: ChatSession[];
  loaded: boolean;
}

type Action =
  | { type: "SET_ACCOUNTS"; accounts: Account[] }
  | { type: "SET_TRANSACTIONS"; transactions: Transaction[] }
  | { type: "SET_CATEGORIES"; categories: Category[] }
  | { type: "SET_GOALS"; goals: Goal[] }
  | { type: "SET_SUBSCRIPTIONS"; subscriptions: Subscription[] }
  | { type: "SET_POTS"; pots: Pot[] }
  | { type: "SET_POCKETS"; pockets: SavingPocket[] }
  | { type: "SET_CHAT_SESSIONS"; chatSessions: ChatSession[] }
  | { type: "SET_LOADED"; loaded: boolean };

const initialState: FinanceState = {
  accounts: [],
  transactions: [],
  categories: [],
  goals: [],
  subscriptions: [],
  pots: [],
  pockets: [],
  chatSessions: [],
  loaded: false,
};

function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case "SET_ACCOUNTS": return { ...state, accounts: action.accounts };
    case "SET_TRANSACTIONS": return { ...state, transactions: action.transactions };
    case "SET_CATEGORIES": return { ...state, categories: action.categories };
    case "SET_GOALS": return { ...state, goals: action.goals };
    case "SET_SUBSCRIPTIONS": return { ...state, subscriptions: action.subscriptions };
    case "SET_POTS": return { ...state, pots: action.pots };
    case "SET_POCKETS": return { ...state, pockets: action.pockets };
    case "SET_CHAT_SESSIONS": return { ...state, chatSessions: action.chatSessions };
    case "SET_LOADED": return { ...state, loaded: action.loaded };
    default: return state;
  }
}

const FinanceContext = createContext<{
  state: FinanceState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    async function load() {
      const [accounts, transactions, categories, goals, subscriptions, pots, pockets, chatSessions] =
        await Promise.all([
          Promise.resolve(Storage.getStoredAccounts()),
          Promise.resolve(Storage.getStoredTransactions()),
          Promise.resolve(Storage.getStoredCategories()),
          Promise.resolve(Storage.getStoredGoals()),
          Promise.resolve(Storage.getStoredSubscriptions()),
          Promise.resolve(Storage.getStoredPots()),
          Promise.resolve(Storage.getStoredPockets()),
          Promise.resolve(Storage.getStoredChatSessions()),
        ]);
      dispatch({ type: "SET_ACCOUNTS", accounts });
      dispatch({ type: "SET_TRANSACTIONS", transactions });
      dispatch({ type: "SET_CATEGORIES", categories });
      dispatch({ type: "SET_GOALS", goals });
      dispatch({ type: "SET_SUBSCRIPTIONS", subscriptions });
      dispatch({ type: "SET_POTS", pots });
      dispatch({ type: "SET_POCKETS", pockets });
      dispatch({ type: "SET_CHAT_SESSIONS", chatSessions });
      dispatch({ type: "SET_LOADED", loaded: true });
    }
    load();
  }, []);

  return (
    <FinanceContext.Provider value={{ state, dispatch }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
