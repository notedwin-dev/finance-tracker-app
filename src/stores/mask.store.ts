import { create } from "zustand";

export interface MaskState {
  maskMode: boolean;
}

export interface MaskActions {
  setMaskMode: (mode: boolean) => void;
  reset: () => void;
}

const initialMaskState: MaskState = {
  maskMode: false,
};

export const useMaskStore = create<MaskState & MaskActions>((set) => ({
  ...initialMaskState,

  setMaskMode: (mode) => set({ maskMode: mode }),
  reset: () => set(initialMaskState),
}));
