import { useReducer, useCallback } from "react";
import { Transaction } from "../../types";

type BatchState = {
  selectedIds: string[];
  isBatchMode: boolean;
  showBatchEditModal: boolean;
  batchUpdates: Partial<Transaction>;
  isSubmitting: boolean;
};

type BatchAction =
  | { type: "TOGGLE_SELECT"; id: string }
  | { type: "SELECT_ALL"; ids: string[] }
  | { type: "CLEAR" }
  | { type: "ENTER_BATCH_MODE" }
  | { type: "EXIT_BATCH_MODE" }
  | { type: "OPEN_EDIT_MODAL" }
  | { type: "CLOSE_EDIT_MODAL" }
  | { type: "SET_BATCH_UPDATES"; updates: Partial<Transaction> }
  | { type: "START_SUBMIT" }
  | { type: "END_SUBMIT" };

const initialState: BatchState = {
  selectedIds: [],
  isBatchMode: false,
  showBatchEditModal: false,
  batchUpdates: {},
  isSubmitting: false,
};

function batchReducer(state: BatchState, action: BatchAction): BatchState {
  switch (action.type) {
    case "TOGGLE_SELECT": {
      const isSelected = state.selectedIds.includes(action.id);
      const next = isSelected
        ? state.selectedIds.filter((i) => i !== action.id)
        : [...state.selectedIds, action.id];
      return {
        ...state,
        selectedIds: next,
        isBatchMode: next.length > 0,
      };
    }
    case "SELECT_ALL":
      return {
        ...state,
        selectedIds: action.ids,
        isBatchMode: action.ids.length > 0,
      };
    case "CLEAR":
      return {
        ...state,
        selectedIds: [],
        isBatchMode: false,
        showBatchEditModal: false,
        batchUpdates: {},
        isSubmitting: false,
      };
    case "ENTER_BATCH_MODE":
      return { ...state, isBatchMode: true };
    case "EXIT_BATCH_MODE":
      return { ...state, isBatchMode: false, selectedIds: [] };
    case "OPEN_EDIT_MODAL":
      return { ...state, showBatchEditModal: true };
    case "CLOSE_EDIT_MODAL":
      return { ...state, showBatchEditModal: false, batchUpdates: {} };
    case "SET_BATCH_UPDATES":
      return { ...state, batchUpdates: action.updates };
    case "START_SUBMIT":
      return { ...state, isSubmitting: true };
    case "END_SUBMIT":
      return {
        ...state,
        isSubmitting: false,
        selectedIds: [],
        showBatchEditModal: false,
        batchUpdates: {},
        isBatchMode: false,
      };
    default:
      return state;
  }
}

interface UseBatchSelectionResult {
  selectedIds: string[];
  isBatchMode: boolean;
  showBatchEditModal: boolean;
  batchUpdates: Partial<Transaction>;
  isSubmitting: boolean;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  enterBatchMode: () => void;
  exitBatchMode: () => void;
  openEditModal: () => void;
  closeEditModal: () => void;
  setBatchUpdates: (updates: Partial<Transaction>) => void;
  startSubmit: () => void;
  endSubmit: () => void;
}

export function useBatchSelection(): UseBatchSelectionResult {
  const [state, dispatch] = useReducer(batchReducer, initialState);

  const toggleSelection = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_SELECT", id });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    dispatch({ type: "SELECT_ALL", ids });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const enterBatchMode = useCallback(() => {
    dispatch({ type: "ENTER_BATCH_MODE" });
  }, []);

  const exitBatchMode = useCallback(() => {
    dispatch({ type: "EXIT_BATCH_MODE" });
  }, []);

  const openEditModal = useCallback(() => {
    dispatch({ type: "OPEN_EDIT_MODAL" });
  }, []);

  const closeEditModal = useCallback(() => {
    dispatch({ type: "CLOSE_EDIT_MODAL" });
  }, []);

  const setBatchUpdates = useCallback((updates: Partial<Transaction>) => {
    dispatch({ type: "SET_BATCH_UPDATES", updates });
  }, []);

  const startSubmit = useCallback(() => {
    dispatch({ type: "START_SUBMIT" });
  }, []);

  const endSubmit = useCallback(() => {
    dispatch({ type: "END_SUBMIT" });
  }, []);

  return {
    selectedIds: state.selectedIds,
    isBatchMode: state.isBatchMode,
    showBatchEditModal: state.showBatchEditModal,
    batchUpdates: state.batchUpdates,
    isSubmitting: state.isSubmitting,
    toggleSelection,
    selectAll,
    clearSelection,
    enterBatchMode,
    exitBatchMode,
    openEditModal,
    closeEditModal,
    setBatchUpdates,
    startSubmit,
    endSubmit,
  };
}
