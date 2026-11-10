import { describe, it, expect } from "vitest";
import { parseSheetRow } from "../helpers/sheets.helper";
import { matchesSearch } from "../components/history/useFilteredTransactions";

// Regression context: a date typed into the SHEet "Shop" column comes back from
// the Sheets API (UNFORMATTED_VALUE) as the Excel serial number 46214. The old
// inline row parsers stored it raw, so `matchesSearch` called
// `(46214).toLowerCase()` during render and React unmounted the app (black screen).
describe("parseSheetRow", () => {
  const TX_HEADERS = [
    "id",
    "userId",
    "accountId",
    "amount",
    "currency",
    "type",
    "shopName",
    "note",
    "date",
    "categoryId",
    "isHistorical",
    "updatedAt",
  ];

  it("coerces number cells in text columns to strings", () => {
    const row = [
      "d24f98fa-c242-4be1-8576-04e07cc2b980",
      "105084147593511773354",
      "acc_main",
      46214,
      "MYR",
      "EXPENSE",
      46214, // date typed into the Shop column -> serial number from Sheets
      " Cookies",
      "2026-07-10",
      4,
      "false",
      1700000000000,
    ];
    const parsed = parseSheetRow(TX_HEADERS, row, "Transactions");

    expect(parsed.shopName).toBe("46214");
    expect(typeof parsed.shopName).toBe("string");
  });

  it("keeps numeric columns numeric and timestamp cells numeric", () => {
    const row = [
      "tx1",
      "u1",
      "a1",
      46214, // number cell in amount column stays a number
      "USD",
      "EXPENSE",
      "Coffee",
      "note",
      "2026-01-01",
      "c1",
      "false",
      1700000000000, // timestamp cell stays a number
    ];
    const parsed = parseSheetRow(TX_HEADERS, row, "Transactions");

    expect(parsed.amount).toBe(46214);
    expect(typeof parsed.updatedAt).toBe("number");
    expect(parsed.isHistorical).toBe(false);
  });

  it("converts serial dates and times in date/time columns", () => {
    const parsed = parseSheetRow(
      ["id", "date", "time"],
      ["tx1", 44927, 0.5], // 44927 === 2023-01-01 in Sheets serials; 0.5 === 12:00
      "Transactions",
    );
    expect(parsed.date).toBe("2023-01-01");
    expect(parsed.time).toBe("12:00");
  });

  it("parses JSON cells and string numbers in numeric columns", () => {
    const parsed = parseSheetRow(
      ["id", "amount", "amountBreakdown"],
      ["tx1", "12.5", '[{"id":"x","description":"part","amount":1}]'],
      "Transactions",
    );
    expect(parsed.amount).toBe(12.5);
    expect(parsed.amountBreakdown).toEqual([
      { id: "x", description: "part", amount: 1 },
    ]);
  });

  it("keeps boolean words as text in text columns", () => {
    const parsed = parseSheetRow(
      ["id", "shopName", "isHistorical"],
      ["tx1", "true", "TRUE"],
      "Transactions",
    );
    expect(parsed.shopName).toBe("true");
    expect(parsed.isHistorical).toBe(true);
  });

  it("coerces numbers in other sheets' text columns (Accounts)", () => {
    const parsed = parseSheetRow(
      ["id", "name", "iconValue", "balance"],
      ["acc1", 12345, 7, 500],
      "Accounts",
    );
    expect(parsed.name).toBe("12345");
    expect(parsed.iconValue).toBe("7");
    expect(parsed.balance).toBe(500);
  });

  it("coerces unknown and JSON columns too; keeps numeric columns intact", () => {
    const parsed = parseSheetRow(
      ["id", "amountBreakdown", "active", "currentAmount"],
      ["tx1", 5, true, 300],
      "Transactions",
    );
    expect(parsed.amountBreakdown).toBe("5");
    expect(parsed.active).toBe(true); // boolean word round-trips in a non-text column
    expect(parsed.currentAmount).toBe(300); // numeric column keeps the number
  });

  it("omits keys for missing trailing cells instead of writing \"undefined\"", () => {
    // Sheets omits trailing empty cells; toAccountId/subscriptionId etc.
    // must stay absent, not the truthy string "undefined" (broken linking).
    const parsed = parseSheetRow(
      ["id", "shopName", "potId", "toAccountId", "subscriptionId"],
      ["tx1", "Coffee", "pot1"],
      "Transactions",
    );
    expect(parsed.id).toBe("tx1");
    expect(parsed.shopName).toBe("Coffee");
    expect(parsed.potId).toBe("pot1");
    expect("toAccountId" in parsed).toBe(false);
    expect("subscriptionId" in parsed).toBe(false);
  });

  it("keeps JSON-looking values as strings in text columns", () => {
    // A shop literally named "[2024]" must stay text: JSON.parse would make
    // it an array and break search/AI string handling.
    const parsed = parseSheetRow(
      ["id", "shopName", "note"],
      ["tx1", "[2024]", "{nested:}"],
      "Transactions",
    );
    expect(parsed.shopName).toBe("[2024]");
    expect(parsed.note).toBe("{nested:}");
  });

  it("keeps JSON parsing for object columns (not in the text-field list)", () => {
    const parsed = parseSheetRow(
      ["id", "amountBreakdown"],
      ["tx1", "{\"x\":1}"],
      "Transactions",
    );
    expect(parsed.amountBreakdown).toEqual({ x: 1 });
  });

  it("parses budgetLimit (Categories) numerically", () => {
    const numeric = parseSheetRow(
      ["id", "budgetLimit"],
      ["cat1", 500],
      "Categories",
    );
    const legacyString = parseSheetRow(
      ["id", "budgetLimit"],
      ["cat1", "500"],
      "Categories",
    );
    expect(numeric.budgetLimit).toBe(500);
    expect(typeof legacyString.budgetLimit).toBe("number");
    expect(legacyString.budgetLimit).toBe(500);
  });

  it("parses tenureMonths (Pockets) numerically so 2 === 2", () => {
    const numeric = parseSheetRow(
      ["id", "tenureMonths"],
      ["pot1", 2],
      "Pockets",
    );
    const legacyString = parseSheetRow(
      ["id", "tenureMonths"],
      ["pot1", "2"],
      "Pockets",
    );
    expect(numeric.tenureMonths).toBe(2);
    expect(legacyString.tenureMonths).toBe(2); // strict === in bonus-rate calc
  });


  it("does not fail search over cloud data shaped like the user's sheet", () => {
    const tx: any = parseSheetRow(
      ["id", "userId", "accountId", "amount", "currency", "type", "shopName", "note", "date", "categoryId"],
      ["tx1", "u1", "a1", 25.5, "MYR", "EXPENSE", 46214, "", "2026-07-10", "c1"],
      "Transactions",
    );
    expect(() => matchesSearch(tx, "coffee", [], [])).not.toThrow();
    expect(matchesSearch(tx, "46214", [], [])).toBe(true);
  });
});
