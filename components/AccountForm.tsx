import React, { useState, useEffect } from "react";
import { Account, ASSET_PROVIDERS } from "../types";
import { XMarkIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";

interface Props {
  initialAccount?: Account;
  accounts: Account[];
  onSave: (account: Omit<Account, "userId">) => void; // App handles userId injection
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

  // Form State
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

  // Details
  const [accountNumber, setAccountNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [note, setNote] = useState("");

  // Initialize form with account data
  const loadAccountData = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setBalance(acc.balance.toString());
    setCurrency(acc.currency);
    setType(acc.type);
    setIconType(acc.iconType);
    setIconValue(acc.iconValue);
    setSelectedProviderId(acc.providerId || null);

    setAccountNumber(acc.details?.accountNumber || "");
    setCardNumber(acc.details?.cardNumber || "");
    setHolderName(acc.details?.holderName || "");
    setExpiry(acc.details?.expiry || "");
    setCvv(acc.details?.cvv || "");
    setNote(acc.details?.note || "");

    // Auto switch tab based on icon type
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
    setAccountNumber("");
    setCardNumber("");
    setHolderName("");
    setExpiry("");
    setCvv("");
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
    if (provider.type === "CRYPTO") setCurrency("USD");
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digits
    const val = e.target.value.replace(/\D/g, "");
    // Group by 4
    const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    if (formatted.length <= 19) {
      // 16 digits + 3 spaces
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 4) val = val.slice(0, 4);

    if (val.length >= 3) {
      setExpiry(val.slice(0, 2) + "/" + val.slice(2));
    } else {
      setExpiry(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: editingId || crypto.randomUUID(),
      name,
      balance: parseFloat(balance) || 0,
      currency,
      type,
      color: "bg-gradient-to-br from-gray-800 to-gray-900",
      iconType,
      iconValue,
      providerId: selectedProviderId || undefined,
      details: {
        accountNumber,
        cardNumber,
        holderName,
        expiry,
        cvv,
        note,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 md:p-6 animate-fadeIn">
      <div className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-800 shadow-2xl flex flex-col h-[90vh] sm:h-auto max-h-[95vh] overflow-hidden animate-slideUp sm:animate-fadeIn">
        {/* Header with Asset Selector */}
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
                        {a.name} ({a.currency} {a.balance})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                <ChevronUpDownIcon className="w-4 h-4 sm:w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5 sm:space-y-6 pb-20 sm:pb-5">
          {/* Tabs */}
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
                  type="number"
                  step="any"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white font-bold text-lg focus:border-primary focus:outline-none"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white focus:border-primary focus:outline-none appearance-none"
                >
                  <option value="MYR">MYR (RM)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {/* Custom Icon Fields */}
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
                    className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm"
                    placeholder={
                      iconType === "EMOJI" ? "e.g. 💰" : "https://..."
                    }
                  />
                </div>
              </div>
            )}

            {/* Account Details Section */}
            <div className="border-t border-gray-800 pt-4 mt-2">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className="bg-surface p-1 rounded border border-gray-700 text-xs">
                  🔒
                </span>
                Account & Card Details
              </h3>

              <div className="space-y-4">
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-primary focus:outline-none"
                  placeholder="Account Holder Name (Optional)"
                />

                {/* Banking Section */}
                <div className="bg-surface/50 p-3 rounded-xl border border-gray-700/50">
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">
                    Banking Details (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none font-mono"
                    placeholder="Account Number"
                  />
                </div>

                {/* Card Section */}
                <div className="bg-surface/50 p-3 rounded-xl border border-gray-700/50 space-y-3">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block">
                    Card Details (Optional)
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none font-mono"
                    placeholder="0000 0000 0000 0000"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={expiry}
                      onChange={handleExpiryChange}
                      className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none"
                      placeholder="Expiry (MM/YY)"
                    />
                    <input
                      type="password"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      className="w-full bg-background border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none"
                      placeholder="CVV"
                    />
                  </div>
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-primary focus:outline-none"
                  placeholder="Additional Notes..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 space-y-3">
          <button
            onClick={handleSubmit}
            className="w-full bg-primary hover:bg-primaryDark text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
          >
            {editingId ? "Update Asset" : "Add Asset"}
          </button>
          {editingId && onDelete && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Are you sure you want to delete ${name}? This will remove it from your holdings.`,
                  )
                ) {
                  onDelete(editingId, name);
                  onClose();
                }
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3 rounded-xl transition-all border border-red-500/20"
            >
              Delete Asset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountForm;
