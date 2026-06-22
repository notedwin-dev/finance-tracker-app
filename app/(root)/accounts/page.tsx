"use client";

import Link from "next/link";
import { useFinance } from "@/lib/finance-context";

export default function AccountsPage() {
  const { state } = useFinance();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-white">Accounts</h1>
      <div className="grid gap-3">
        {state.accounts.map((acc) => (
          <Link
            key={acc.id}
            href={`/accounts/${acc.id}`}
            className="rounded-xl bg-card border border-zinc-800 p-4 flex justify-between items-center hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{acc.iconValue}</span>
              <div>
                <p className="text-white font-medium">{acc.name}</p>
                <p className="text-zinc-500 text-xs">{acc.type}</p>
              </div>
            </div>
            <p className="text-white font-semibold">
              {acc.balance.toLocaleString("en-MY", { style: "currency", currency: acc.currency || "MYR" })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
