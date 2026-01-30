import React, { useState } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import { PlusIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useData } from "../context/DataContext";
import AccountCard from "../components/AccountCard";
import { Account } from "../types";

const AssetsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    accounts,
    pots,
    transactions,
    usdRate,
    cryptoPrices,
    displayCurrency,
  } = useData();
  const { setShowAccountForm, setEditingAccount } = useOutletContext<any>();

  return (
    <div className="animate-fadeIn space-y-8 pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/app"
            className="p-2 bg-surface/50 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 block">
              Manage Items
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              My Assets
            </h1>
          </div>
        </div>
        <button
          onClick={() => setShowAccountForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-black tracking-tight shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden sm:inline">ADD ASSET</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <AccountCard
            key={acc.id}
            account={acc}
            pots={pots}
            transactions={transactions}
            onClick={(a) => navigate(`/app/account/${a.id}`)}
            displayCurrency={displayCurrency}
            usdRate={usdRate}
            cryptoPrices={cryptoPrices}
          />
        ))}

        {/* Add Asset Card */}
        <button
          onClick={() => setShowAccountForm(true)}
          className="flex flex-col items-center justify-center gap-4 h-70 rounded-[2.5rem] bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all group"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <PlusIcon className="w-8 h-8 text-indigo-400 stroke-3" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
            Add New Asset
          </span>
        </button>
      </div>
    </div>
  );
};

export default AssetsPage;
