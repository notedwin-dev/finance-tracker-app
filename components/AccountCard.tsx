import React from "react";
import { Account, Pot } from "../types";
import { CreditCardIcon, WalletIcon } from "@heroicons/react/24/outline";

interface Props {
  account: Account;
  pots: Pot[];
  onClick: (account: Account) => void;
}

const AccountCard: React.FC<Props> = ({ account, pots, onClick }) => {
  const accountPots = pots.filter((p) => p.accountId === account.id);
  const totalInPots = accountPots.reduce((sum, p) => sum + p.currentAmount, 0);
  const availableBalance = account.balance - totalInPots;

  // Dynamic border color based on account type
  const getBorderColor = () => {
    switch (account.type) {
      case "CRYPTO":
        return "border-orange-500/20 hover:border-orange-500/50";
      case "INVESTMENT":
        return "border-purple-500/20 hover:border-purple-500/50";
      default:
        return "border-gray-800 hover:border-gray-600";
    }
  };

  const hasAccountNum = !!account.details?.accountNumber;
  const hasCardNum = !!account.details?.cardNumber;

  // Mask card number: Show only last 4 digits
  const getMaskedCardNumber = (num: string) => {
    // Remove spaces first
    const clean = num.replace(/\s/g, "");
    if (clean.length < 4) return clean;
    return `**** **** **** ${clean.slice(-4)}`;
  };

  return (
    <div
      className={`relative rounded-2xl bg-card border ${getBorderColor()} shadow-sm transition-all duration-200 hover:bg-surface hover:shadow-lg cursor-pointer p-5 group flex flex-col justify-between h-full`}
      onClick={() => onClick(account)}
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            {account.iconType === "IMAGE" ? (
              <img
                src={account.iconValue}
                alt={account.name}
                className="w-10 h-10 object-contain bg-white/5 rounded-full p-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-xl border border-gray-700">
                {account.iconValue}
              </div>
            )}
            <div>
              <h4 className="font-bold text-sm text-gray-100 leading-tight">
                {account.name}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-500 uppercase font-medium tracking-wide bg-white/5 px-1.5 py-0.5 rounded inline-block">
                  {account.type}
                </span>
                {hasAccountNum && (
                  <span className="font-mono text-[10px] text-gray-400 tracking-wider">
                    • {account.details?.accountNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">
                Current Balance
              </p>
              <p className="text-2xl font-bold text-white tracking-tight group-hover:text-primary transition-colors">
                {account.currency === "MYR" ? "RM" : "£"}{" "}
                {account.balance.toLocaleString()}
              </p>
            </div>
            {totalInPots > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-primary uppercase tracking-widest font-bold mb-0.5 flex items-center justify-end gap-1">
                  <WalletIcon className="w-3 h-3" /> Available
                </p>
                <p className="text-lg font-bold text-success leading-tight">
                  {account.currency === "MYR" ? "RM" : "£"}{" "}
                  {availableBalance.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {accountPots.length > 0 && (
            <div className="pt-2 border-t border-gray-800 flex gap-2 overflow-hidden">
              {accountPots.map((p) => (
                <div
                  key={p.id}
                  className="w-1.5 h-1.5 rounded-full bg-primary/40"
                  title={p.name}
                />
              ))}
              <span className="text-[10px] text-gray-500">
                {accountPots.length} Active Pots
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Footer */}
      {hasCardNum && (
        <div className="mt-2 space-y-2 pt-3 border-t border-gray-800/50">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-gray-500">
              <CreditCardIcon className="w-3.5 h-3.5" />
              <span>Card</span>
            </div>
            <div className="text-right flex items-center gap-2">
              <p className="font-mono text-gray-400 text-[10px]">
                {getMaskedCardNumber(account.details!.cardNumber!)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detail Hint */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 text-gray-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </div>
    </div>
  );
};

export default AccountCard;
