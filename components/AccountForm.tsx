import React, { useState, useEffect } from "react";
import { Account, ASSET_PROVIDERS } from "../types";
import {
  XMarkIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import Modal from "./Modal";

interface Props {
  initialAccount?: Account;
  accounts: Account[];
  onSave: (account: Omit<Account, "userId">) => void;
  onDelete?: (id: string, name: string) => void;
  onClose: () => void;
}

const AccountForm: React.FC<Props> = ({
  initialAccount,
  accounts,
  onSave,
  onDelete,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"PRESETS" | "CUSTOM">("PRESETS");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState<Account["currency"]>("MYR");
  const [type, setType] = useState<Account["type"]>("BANK");
  const [iconType, setIconType] = useState<Account["iconType"]>("EMOJI");
  const [iconValue, setIconValue] = useState("🏦");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sanitizeNote = (value: string) =>
    value
      .replace(/\b(cvv|cvc)\s*:?\s*\d{3,4}\b/gi, "[redacted]")
      .replace(/\d[ -]?(?:\d[ -]?){12,18}\d/g, (run) => {
        const digits = run.replace(/\D/g, "");
        return digits.length >= 13 && digits.length <= 19 ? "[redacted]" : run;
      });

  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmLabel: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
    confirmLabel: "Confirm",
  });

  const handleBalanceChange = (val: string) => {
    if (!val) {
      setBalance("");
      return;
    }

    if (currency === "BTC" || currency === "ETH") {
      if (/^\d*\.?\d*$/.test(val)) {
        setBalance(val);
      }
      return;
    }

    if (val.endsWith(".") && !balance.endsWith(".")) {
      const d = balance.replace(/\D/g, "");
      setBalance(parseInt(d || "0", 10).toString() + ".");
      return;
    }

    if (balance.endsWith(".") || balance.match(/\.\d$/)) {
      const parts = balance.split(".");
      const newChar = val.length > balance.length ? val.slice(-1) : "";
      if (/\d/.test(newChar)) {
        if (parts[1] === "") {
          setBalance(parts[0] + "." + newChar);
          return;
        }
        if (parts[1].length === 1) {
          setBalance(parts[0] + "." + parts[1] + newChar);
          return;
        }
      }
    }

    const digits = val.replace(/\D/g, "");
    if (!digits) {
      setBalance("");
      return;
    }
    const cents = parseInt(digits, 10);
    setBalance((cents / 100).toFixed(2));
  };

  const loadAccountData = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setBalance(acc.balance.toFixed(2));
    setCurrency(acc.currency);
    setType(acc.type);
    setIconType(acc.iconType);
    setIconValue(acc.iconValue);
    setSelectedProviderId(acc.providerId || null);
    setNote(acc.note || "");

    if (acc.providerId) setActiveTab("PRESETS");
    else if (acc.iconType === "EMOJI") setActiveTab("CUSTOM");
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setBalance("");
    setCurrency("MYR");
    setType("BANK");
    setIconType("EMOJI");
    setIconValue("🏦");
    setSelectedProviderId(null);
    setNote("");
    setActiveTab("PRESETS");
  };

  useEffect(() => {
    if (initialAccount) {
      loadAccountData(initialAccount);
    } else {
      resetForm();
    }
  }, [initialAccount]);

  const handleAssetSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "NEW") {
      resetForm();
    } else {
      const acc = accounts.find((a) => a.id === val);
      if (acc) loadAccountData(acc);
    }
  };

  const handlePresetSelect = (provider: (typeof ASSET_PROVIDERS)[0]) => {
    setSelectedProviderId(provider.id);
    setName(provider.name);
    setType(provider.type as any);
    setIconType("IMAGE");
    setIconValue(provider.icon);
    if ((provider as any).currency) {
      setCurrency((provider as any).currency);
    } else if (provider.type === "CRYPTO") {
      setCurrency("USD");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingId || crypto.randomUUID(),
        name,
        balance: parseFloat(balance) || 0,
        currency,
        type,
        color: "bg-gradient-to-br from-gray-800 to-gray-900",
        iconType,
        iconValue,
        providerId: selectedProviderId || undefined,
        note: note || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 md:p-6 animate-fadeIn">
      <div className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-800 shadow-2xl flex flex-col h-[90vh] sm:h-auto max-h-[95vh] overflow-hidden animate-slideUp sm:animate-fadeIn">
        <div className="p-4 sm:p-5 border-b border-gray-800 space-y-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Manage Asset
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="relative">
            <label className="block text-[10px] sm:text-xs font-bold text-primary mb-1 uppercase tracking-wide">
              Select Asset to Edit
            </label>
            <div className="relative">
              <select
                value={editingId || "NEW"}
                onChange={handleAssetSelectChange}
                className="w-full bg-surface border border-gray-700 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm appearance-none focus:border-primary focus:outline-none pr-10 font-medium"
              >
                <option value="NEW">✨ Create New Asset</option>
                {accounts.length > 0 && (
                  <optgroup label="Existing Assets">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency} {a.balance.toFixed(2)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                <ChevronUpDownIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5 sm:space-y-6 pb-20 sm:pb-5">
          <div className="flex p-1 bg-surface rounded-lg">
            <button
              onClick={() => setActiveTab("PRESETS")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "PRESETS" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
            >
              Popular Assets
            </button>
            <button
              onClick={() => setActiveTab("CUSTOM")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "CUSTOM" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
            >
              Custom
            </button>
          </div>

          {activeTab === "PRESETS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {ASSET_PROVIDERS.map((p) => {
                  const isSelected = selectedProviderId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(p)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 relative ${
                        isSelected
                          ? "border-primary bg-primary/20 shadow-lg shadow-primary/10 scale-105 z-10"
                          : "border-gray-800 bg-surface/50 hover:bg-gray-800 hover:border-gray-600"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      )}
                      <img
                        src={p.icon}
                        alt={p.name}
                        className="w-10 h-10 object-contain bg-white rounded-full p-1 shadow-sm"
                      />
                      <span
                        className={`text-[10px] text-center font-medium leading-tight ${isSelected ? "text-white" : "text-gray-400"}`}
                      >
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Asset Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                placeholder="e.g. Main Savings"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Balance
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={balance}
                  onChange={(e) => handleBalanceChange(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white font-bold text-lg focus:border-primary focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Currency / Symbol
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none pr-12 font-bold uppercase"
                    placeholder="MYR"
                    list="currency-options"
                  />
                  <datalist id="currency-options">
                    <option value="MYR" />
                    <option value="USD" />
                    <option value="BTC" />
                    <option value="ETH" />
                    <option value="USDT" />
                    <option value="TRX" />
                  </datalist>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] font-bold">
                    SYMBOL
                  </div>
                </div>
              </div>
            </div>

            {activeTab === "CUSTOM" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Icon Type
                  </label>
                  <select
                    value={iconType}
                    onChange={(e) => setIconType(e.target.value as any)}
                    className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm"
                  >
                    <option value="EMOJI">Emoji</option>
                    <option value="IMAGE">Image URL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    value={iconValue}
                    onChange={(e) => setIconValue(e.target.value)}
                    className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-primary focus:outline-none"
                    placeholder={
                      iconType === "EMOJI" ? "e.g. 💰" : "https://..."
                    }
                  />
                </div>
              </div>
            )}

            <div className="border-t border-gray-800 pt-4 mt-2">
              <h3 className="text-sm font-bold text-white mb-3">Notes</h3>
              <textarea
                value={note}
                onChange={(e) => setNote(sanitizeNote(e.target.value))}
                className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-primary focus:outline-none"
                placeholder="Optional notes (e.g. payment reference, internal memo)"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full text-white font-bold py-3 rounded-xl transition-all shadow-lg ${
              isSubmitting
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-primary hover:bg-primaryDark shadow-indigo-500/20"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : editingId
                ? "Update Asset"
                : "Add Asset"}
          </button>
          {editingId && onDelete && (
            <button
              onClick={() => {
                setConfirmationModal({
                  isOpen: true,
                  title: "Delete Asset",
                  description: `Are you sure you want to delete ${name}? This will remove it from your holdings.`,
                  confirmLabel: "Delete",
                  isDestructive: true,
                  onConfirm: () => {
                    onDelete(editingId, name);
                    onClose();
                  },
                });
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3 rounded-xl transition-all border border-red-500/20"
            >
              Delete Asset
            </button>
          )}
        </div>
      </div>

      <Modal
        isOpen={confirmationModal.isOpen}
        onClose={() =>
          setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
        }
        title={confirmationModal.title}
        description={confirmationModal.description}
        icon={confirmationModal.isDestructive ? XMarkIcon : undefined}
        iconColor={
          confirmationModal.isDestructive ? "text-rose-400" : "text-primary"
        }
        iconBgColor={
          confirmationModal.isDestructive ? "bg-rose-500/10" : "bg-primary/10"
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
            }
            className="py-3 px-4 rounded-xl font-bold text-sm bg-surface border border-gray-700 hover:bg-gray-800 text-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              confirmationModal.onConfirm();
              setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
            }}
            className={`py-3 px-4 rounded-xl font-bold text-sm transition-colors shadow-lg ${
              confirmationModal.isDestructive
                ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white"
                : "bg-primary hover:bg-primaryDark shadow-primary/20 text-white"
            }`}
          >
            {confirmationModal.confirmLabel}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default AccountForm;
