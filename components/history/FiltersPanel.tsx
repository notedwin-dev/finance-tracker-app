import React, { useRef } from "react";
import DatePicker from "../DatePicker";
import { Account } from "../../types";
import { XMarkIcon, CheckCircleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/solid";

interface Props {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;

  accountIds: string[];
  accounts: Account[];
  onAccountIdsChange: (ids: string[]) => void;

  onClose?: () => void;
}

const AccountIcon: React.FC<{ account: Account }> = ({ account }) => {
  if (account.iconType === "IMAGE") {
    return (
      <img
        src={account.iconValue}
        alt=""
        className="w-5 h-5 object-contain shrink-0"
      />
    );
  }
  return <span className="text-base leading-none">{account.iconValue}</span>;
};

const FiltersPanel: React.FC<Props> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  accountIds,
  accounts,
  onAccountIdsChange,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = !!(startDate || endDate || accountIds.length > 0);

  const toggleAccount = (id: string) => {
    if (accountIds.includes(id)) {
      onAccountIdsChange(accountIds.filter((a) => a !== id));
    } else {
      onAccountIdsChange([...accountIds, id]);
    }
  };

  const filterBody = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
          Filters
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5"
          >
            <XMarkIcon className="w-4 h-4" />
            Close
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-[10px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-300 transition-colors py-2 -ml-1"
        >
          <ArrowUturnLeftIcon className="w-3 h-3" />
          Reset all filters
        </button>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            Accounts
          </label>
          {accountIds.length > 0 && (
            <button
              onClick={() => onAccountIdsChange([])}
              className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-xl hover:bg-white/5"
            >
              Clear selection ({accountIds.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const selected = accountIds.includes(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggleAccount(a.id)}
                className={`shrink-0 px-4 py-3 rounded-xl text-[11px] font-black tracking-widest transition-all flex items-center gap-2 ${
                  selected
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-400"
                    : "bg-black/40 text-gray-500 border border-white/5 hover:border-white/10"
                }`}
              >
                <AccountIcon account={a} />
                <span className={selected ? "text-white" : "text-gray-300"}>
                  {a.name}
                </span>
                {selected && <CheckCircleIcon className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
        {accountIds.length === 0 && (
          <p className="text-[10px] text-gray-600 font-bold ml-1">
            All accounts selected
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Date Range
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DatePicker value={startDate} onChange={onStartDateChange} />
          <DatePicker value={endDate} onChange={onEndDateChange} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile full-screen overlay */}
      <div className="lg:hidden fixed inset-0 z-[200] flex flex-col" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          ref={panelRef}
          className="relative mt-auto bg-surface border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slideUp shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 pt-3">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            {filterBody}
          </div>
          <div className="sticky bottom-0 p-5 pt-2 bg-surface border-t border-white/5">
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20"
            >
              {hasActiveFilters ? `Show Results (${accountIds.length > 0 ? accountIds.length + " account" + (accountIds.length > 1 ? "s" : "") : "All"} · ${startDate || endDate ? "Dates" : "All time"})` : "Show All Transactions"}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop inline panel */}
      <div className="hidden lg:block relative z-55 bg-surface/40 backdrop-blur-md rounded-3xl border border-white/5 animate-slideDown overflow-hidden">
        <div className="p-6">
          {filterBody}
        </div>
      </div>
    </>
  );
};

export default FiltersPanel;
