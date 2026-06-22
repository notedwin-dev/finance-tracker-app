"use client";

import { useFinance } from "@/lib/finance-context";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { state } = useFinance();
  const { data: session } = useSession();

  const totalBalance = state.accounts.reduce((sum, a) => sum + a.balance, 0);
  const recentTransactions = [...state.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-zinc-400 text-sm">Welcome back</p>
        <h1 className="text-2xl font-bold text-white">{session?.user?.name || "User"}</h1>
      </div>

      <div className="rounded-xl bg-card border border-zinc-800 p-4">
        <p className="text-zinc-400 text-sm">Total Balance</p>
        <p className="text-3xl font-bold text-white">
          {totalBalance.toLocaleString("en-MY", { style: "currency", currency: "MYR" })}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Recent Transactions</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-zinc-500 text-sm">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="rounded-lg bg-card border border-zinc-800 p-3 flex justify-between items-center">
                <div>
                  <p className="text-white text-sm">{tx.shopName || tx.type}</p>
                  <p className="text-zinc-500 text-xs">{tx.date}</p>
                </div>
                <p className={`text-sm font-medium ${tx.amount >= 0 ? "text-success" : "text-danger"}`}>
                  {tx.amount.toLocaleString("en-MY", { style: "currency", currency: tx.currency || "MYR" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
