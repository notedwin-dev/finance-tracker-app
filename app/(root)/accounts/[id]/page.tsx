"use client";

import { useParams } from "next/navigation";
import { useFinance } from "@/lib/finance-context";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { state } = useFinance();
  const account = state.accounts.find((a) => a.id === id);

  if (!account) return <div className="p-4 text-zinc-500">Account not found</div>;

  const txs = state.transactions
    .filter((t) => t.accountId === id || t.toAccountId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{account.iconValue}</span>
        <div>
          <h1 className="text-xl font-bold text-white">{account.name}</h1>
          <p className="text-zinc-400 text-sm">{account.type}</p>
        </div>
      </div>
      <div className="rounded-xl bg-card border border-zinc-800 p-4">
        <p className="text-zinc-400 text-sm">Balance</p>
        <p className="text-2xl font-bold text-white">
          {account.balance.toLocaleString("en-MY", { style: "currency", currency: account.currency || "MYR" })}
        </p>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Transactions ({txs.length})</h2>
        {txs.slice(0, 20).map((tx) => (
          <div key={tx.id} className="rounded-lg bg-card border border-zinc-800 p-3 mb-2">
            <p className="text-white text-sm">{tx.shopName || tx.type}</p>
            <p className="text-zinc-500 text-xs">{tx.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
