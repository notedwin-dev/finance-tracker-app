import React from "react";
import Modal from "./Modal";

export interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel: string;
  isDestructive?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ConfirmationModalProps {
  state: ConfirmationModalState;
  onClose: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={state.title}
      description={state.description}
      icon={state.icon}
      iconColor={state.isDestructive ? "text-rose-400" : "text-primary"}
      iconBgColor={state.isDestructive ? "bg-rose-500/10" : "bg-primary/10"}
    >
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onClose}
          className="py-3 px-4 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            state.onConfirm();
            onClose();
          }}
          className={`py-3 px-4 rounded-xl font-bold text-sm transition-colors shadow-lg ${
            state.isDestructive
              ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white"
              : "bg-primary hover:bg-primary-600 shadow-primary/20 text-white"
          }`}
        >
          {state.confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
