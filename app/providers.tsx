"use client";

import { SessionProvider } from "next-auth/react";
import { FinanceProvider } from "@/lib/finance-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FinanceProvider>
        {children}
      </FinanceProvider>
    </SessionProvider>
  );
}
