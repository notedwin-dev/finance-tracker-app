import { create } from "zustand";

export type DisplayCurrency = "MYR" | "USD";

export interface UIState {
  displayCurrency: DisplayCurrency;
}

export interface UIActions {
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  reset: () => void;
}

const initialUIState: UIState = {
  displayCurrency: "MYR",
};

export const useUIStore = create<UIState & UIActions>((set) => ({
  ...initialUIState,

  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
  reset: () => set(initialUIState),
}));
