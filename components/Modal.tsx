import React, { Fragment } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBgColor?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  icon: Icon,
  iconColor = "text-primary",
  iconBgColor = "bg-primary/10",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface w-full max-w-sm rounded-[2rem] border border-white/10 shadow-2xl p-6 space-y-6 relative animate-scaleIn">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          {Icon && (
            <div
              className={`w-16 h-16 ${iconBgColor} rounded-2xl flex items-center justify-center ${iconColor} mx-auto mb-4 shadow-lg`}
            >
              <Icon className="w-8 h-8" />
            </div>
          )}
          <h3 className="text-xl font-black text-white tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-gray-400 font-medium leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
