import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchOverlay from "../../../../components/history/SearchOverlay";
import { TransactionType } from "../../../../types";
import type { Transaction, Category, Account } from "../../../../types";

const mockCategories: Category[] = [
  { id: "c1", name: "Food", icon: "🍔", budgetLimit: 0, color: "bg-orange-500" },
  { id: "c2", name: "Transport", icon: "🚗", budgetLimit: 0, color: "bg-blue-500" },
];

const mockAccounts: Account[] = [
  {
    id: "a1", name: "Maybank", balance: 1000, currency: "MYR",
    type: "BANK", color: "bg-red-500", iconType: "EMOJI", iconValue: "🏦", userId: "u1",
  },
  {
    id: "a2", name: "TNG", balance: 500, currency: "MYR",
    type: "E-WALLET", color: "bg-blue-500", iconType: "EMOJI", iconValue: "📱", userId: "u1",
  },
];

const mockTransactions: Transaction[] = [
  {
    id: "tx1", userId: "u1", accountId: "a1", amount: 50, currency: "MYR",
    type: TransactionType.EXPENSE, categoryId: "c1", shopName: "Restaurant A",
    date: "2026-06-01", createdAt: "2026-06-01T12:00:00Z",
  },
  {
    id: "tx2", userId: "u1", accountId: "a1", amount: 200, currency: "MYR",
    type: TransactionType.INCOME, categoryId: undefined, shopName: "Salary",
    date: "2026-06-02", createdAt: "2026-06-02T12:00:00Z",
  },
  {
    id: "tx3", userId: "u1", accountId: "a1", amount: 100, currency: "MYR",
    type: TransactionType.TRANSFER, categoryId: undefined, shopName: "",
    date: "2026-06-03", createdAt: "2026-06-03T12:00:00Z",
    toAccountId: "a2", transferDirection: "OUT",
    linkedTransactionId: "tx4",
  },
  {
    id: "tx4", userId: "u1", accountId: "a2", amount: 100, currency: "MYR",
    type: TransactionType.TRANSFER, categoryId: undefined, shopName: "",
    date: "2026-06-03", createdAt: "2026-06-03T12:00:00Z",
    transferDirection: "IN", linkedTransactionId: "tx3",
  },
];

function renderOverlay(overrides: Record<string, any> = {}) {
  const defaults = {
    isOpen: true,
    query: "",
    onQueryChange: vi.fn(),
    onClose: vi.fn(),
    transactions: mockTransactions,
    categories: mockCategories,
    accounts: mockAccounts,
    maskAmount: (amount: any) => String(amount),
    maskText: (text: string) => text,
    onSelectTransaction: vi.fn(),
  };
  return render(<SearchOverlay {...defaults} {...overrides} />);
}

describe("SearchOverlay", () => {
  it("renders nothing when closed", () => {
    renderOverlay({ isOpen: false });
    expect(screen.queryByPlaceholderText("Search transactions...")).toBeNull();
  });

  it("shows placeholder when open with no query", () => {
    renderOverlay({ query: "" });
    expect(screen.getByText("Type to search transactions")).toBeTruthy();
  });

  it("shows results when query matches transactions", () => {
    renderOverlay({ query: "restaurant" });
    expect(screen.getByText("1 result")).toBeTruthy();
    expect(screen.getByText("Restaurant A")).toBeTruthy();
  });

  it("shows no results message when query matches nothing", () => {
    renderOverlay({ query: "zzzzzz" });
    expect(screen.getByText(/No results for/)).toBeTruthy();
  });

  it("merges transfer IN/OUT pair into a single result row", () => {
    renderOverlay({ query: "transfer" });
    expect(screen.getByText("Maybank → TNG")).toBeTruthy();
  });

  it("calls onSelectTransaction and closes when user clicks a result", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderOverlay({ query: "restaurant", onSelectTransaction: onSelect, onClose });
    fireEvent.click(screen.getByText("Restaurant A"));
    expect(onSelect).toHaveBeenCalledWith(mockTransactions[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("clears the search query when user clicks the clear button", () => {
    const onQueryChange = vi.fn();
    renderOverlay({ query: "test", onQueryChange });
    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);
    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("closes when user clicks the Esc button", () => {
    const onClose = vi.fn();
    renderOverlay({ query: "test", onClose });
    fireEvent.click(screen.getByText("Esc"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when user presses Escape key", () => {
    const onClose = vi.fn();
    renderOverlay({ query: "test", onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
